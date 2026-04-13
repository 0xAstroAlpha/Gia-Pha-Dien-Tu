'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Heart, Image, FileText, History, Lock, Phone, MapPin, Briefcase, GraduationCap, Tag, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { zodiacYear } from '@/lib/genealogy-types';
import type { PersonDetail } from '@/lib/genealogy-types';
import { CommentSection } from '@/components/comment-section';
import { PersonFormDialog, type PersonFormPerson } from '@/components/person-form-dialog';
import { useAuth } from '@/components/auth-provider';
import { deletePerson } from '@/lib/supabase-data';
import { getEffectiveGeneration } from '@/lib/person-effective-generation';
import { cn } from '@/lib/utils';

function peq(a: string | null | undefined, b: string | null | undefined): boolean {
    return (a ?? null) === (b ?? null);
}

interface RelationshipSnapshot {
    fatherHandle: string | null;
    motherHandle: string | null;
    /** `people.generation` for father, when known */
    fatherGeneration: number | null;
    /** `people.generation` for mother, when known */
    motherGeneration: number | null;
    father: string;
    mother: string;
    siblingsFull: { handle: string; name: string }[];
    siblingsFatherOnly: { handle: string; name: string }[];
    siblingsMotherOnly: { handle: string; name: string }[];
    spouses: { label: 'Vợ' | 'Chồng' | 'Phối ngẫu'; name: string; handle: string }[];
    /** From each child's gender: con trai / con gái relative to this profile person (parent). */
    children: { handle: string; name: string; label: 'Con trai' | 'Con gái' | 'Con' }[];
}

function childLabelFromGender(gender: number): 'Con trai' | 'Con gái' | 'Con' {
    if (gender === 1) return 'Con trai';
    if (gender === 2) return 'Con gái';
    return 'Con';
}

async function loadRelationshipSnapshot(
    personHandle: string,
    gender: number,
    parentFamilies: string[],
    ownFamilies: string[],
): Promise<RelationshipSnapshot> {
    const { supabase } = await import('@/lib/supabase');

    type Fam = {
        handle?: string;
        father_handle: string | null;
        mother_handle: string | null;
        children: string[] | null;
    };

    const { data: birthFromChild } = await supabase
        .from('families')
        .select('handle, father_handle, mother_handle, children')
        .contains('children', [personHandle]);

    let birthListResolved = (birthFromChild ?? []) as Fam[];
    if (birthListResolved.length === 0 && parentFamilies.length > 0) {
        const { data: byHandle } = await supabase
            .from('families')
            .select('handle, father_handle, mother_handle, children')
            .in('handle', parentFamilies);
        birthListResolved = ((byHandle ?? []) as Fam[]).filter((f) =>
            ((f.children as string[]) ?? []).includes(personHandle));
    }
    const birth = birthListResolved[0];
    const F = birth?.father_handle ?? null;
    const M = birth?.mother_handle ?? null;
    const bothParentsUnknown = !F && !M;

    const { data: allFamiliesRaw } = await supabase
        .from('families')
        .select('father_handle, mother_handle, children');
    const allFamilies = (allFamiliesRaw ?? []) as Fam[];

    const fullSet = new Set<string>();
    if (bothParentsUnknown && birthListResolved.length > 0) {
        for (const row of birthListResolved) {
            for (const c of row.children ?? []) {
                if (c !== personHandle) fullSet.add(c);
            }
        }
    } else {
        for (const row of allFamilies) {
            if (peq(row.father_handle, F) && peq(row.mother_handle, M)) {
                for (const c of row.children ?? []) {
                    if (c !== personHandle) fullSet.add(c);
                }
            }
        }
    }

    const fatherHalfSet = new Set<string>();
    if (F) {
        for (const row of allFamilies) {
            if (peq(row.father_handle, F) && !peq(row.mother_handle, M)) {
                for (const c of row.children ?? []) {
                    if (c !== personHandle && !fullSet.has(c)) fatherHalfSet.add(c);
                }
            }
        }
    }

    const motherHalfSet = new Set<string>();
    if (M) {
        for (const row of allFamilies) {
            if (peq(row.mother_handle, M) && !peq(row.father_handle, F)) {
                for (const c of row.children ?? []) {
                    if (c !== personHandle && !fullSet.has(c)) motherHalfSet.add(c);
                }
            }
        }
    }

    const spouseLabel: 'Vợ' | 'Chồng' | 'Phối ngẫu' =
        gender === 2 ? 'Chồng' : gender === 1 ? 'Vợ' : 'Phối ngẫu';

    const spouses: { label: 'Vợ' | 'Chồng' | 'Phối ngẫu'; name: string; handle: string }[] = [];
    const childrenSet = new Set<string>();
    const seenSpouse = new Set<string>();

    if (ownFamilies.length > 0) {
        const { data: famRows } = await supabase
            .from('families')
            .select('father_handle, mother_handle, children')
            .in('handle', ownFamilies);

        for (const row of (famRows ?? []) as Fam[]) {
            const fh = row.father_handle;
            const mh = row.mother_handle;
            let spouseH: string | null = null;
            if (fh === personHandle) spouseH = mh;
            else if (mh === personHandle) spouseH = fh;
            if (spouseH && !seenSpouse.has(spouseH)) {
                seenSpouse.add(spouseH);
                spouses.push({ label: spouseLabel, name: '', handle: spouseH });
            }
            for (const c of row.children ?? []) {
                childrenSet.add(c);
            }
        }
    }

    const nameHandles = new Set<string>();
    if (F) nameHandles.add(F);
    if (M) nameHandles.add(M);
    fullSet.forEach((h) => nameHandles.add(h));
    fatherHalfSet.forEach((h) => nameHandles.add(h));
    motherHalfSet.forEach((h) => nameHandles.add(h));
    spouses.forEach((s) => nameHandles.add(s.handle));
    childrenSet.forEach((h) => nameHandles.add(h));

    const nameByHandle: Record<string, string> = {};
    const genByHandle: Record<string, number | null> = {};
    const genderByHandle: Record<string, number> = {};
    if (nameHandles.size > 0) {
        const { data: peopleRows } = await supabase
            .from('people')
            .select('handle, display_name, generation, gender')
            .in('handle', [...nameHandles]);
        for (const p of peopleRows ?? []) {
            const r = p as Record<string, unknown>;
            const h = r.handle as string;
            nameByHandle[h] = (r.display_name as string) || h;
            const g = r.generation;
            genByHandle[h] = typeof g === 'number' && !Number.isNaN(g) ? g : null;
            const gd = r.gender;
            genderByHandle[h] = typeof gd === 'number' && !Number.isNaN(gd) ? gd : 0;
        }
    }

    const mapNames = (handles: Set<string>) =>
        [...handles]
            .map((h) => ({ handle: h, name: nameByHandle[h] || h }))
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    for (const s of spouses) {
        s.name = nameByHandle[s.handle] || s.handle;
    }

    const childrenList = [...childrenSet]
        .map((h) => ({
            handle: h,
            name: nameByHandle[h] || h,
            label: childLabelFromGender(genderByHandle[h] ?? 0),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    return {
        fatherHandle: F,
        motherHandle: M,
        fatherGeneration: F ? genByHandle[F] ?? null : null,
        motherGeneration: M ? genByHandle[M] ?? null : null,
        father: F ? (nameByHandle[F] || '—') : '—',
        mother: M ? (nameByHandle[M] || '—') : '—',
        siblingsFull: mapNames(fullSet),
        siblingsFatherOnly: mapNames(fatherHalfSet),
        siblingsMotherOnly: mapNames(motherHalfSet),
        spouses,
        children: childrenList.length > 0 ? childrenList : [],
    };
}

function rowToPersonDetail(row: Record<string, unknown>): PersonDetail {
    return {
        handle: row.handle as string,
        gramps_id: row.gramps_id as string | undefined,
        displayName: row.display_name as string,
        gender: row.gender as number,
        surname: (row.surname as string) || undefined,
        firstName: (row.first_name as string) || undefined,
        generation: row.generation as number,
        chi: row.chi as number | undefined,
        birthYear: row.birth_year as number | undefined,
        birthDate: row.birth_date as string | undefined,
        birthPlace: row.birth_place as string | undefined,
        deathYear: row.death_year as number | undefined,
        deathDate: row.death_date as string | undefined,
        deathPlace: row.death_place as string | undefined,
        isLiving: row.is_living as boolean,
        isPrivacyFiltered: row.is_privacy_filtered as boolean,
        isPatrilineal: row.is_patrilineal as boolean,
        families: (row.families as string[]) || [],
        parentFamilies: (row.parent_families as string[]) || [],
        phone: row.phone as string | undefined,
        email: row.email as string | undefined,
        zalo: row.zalo as string | undefined,
        facebook: row.facebook as string | undefined,
        currentAddress: row.current_address as string | undefined,
        hometown: row.hometown as string | undefined,
        occupation: row.occupation as string | undefined,
        company: row.company as string | undefined,
        education: row.education as string | undefined,
        nickName: row.nick_name as string | undefined,
        notes: row.notes as string | undefined,
    };
}

export default function PersonProfilePage() {
    const params = useParams();
    const router = useRouter();
    const handle = params.handle as string;
    const { isAdmin } = useAuth();
    const [person, setPerson] = useState<PersonDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [peopleForDialog, setPeopleForDialog] = useState<PersonFormPerson[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [relationships, setRelationships] = useState<RelationshipSnapshot | null>(null);
    /** null = still computing effective đời from family graph */
    const [effectiveGeneration, setEffectiveGeneration] = useState<number | undefined | null>(null);

    const fetchPerson = useCallback(async () => {
        try {
            const { supabase } = await import('@/lib/supabase');
            const { data, error } = await supabase
                .from('people')
                .select('*')
                .eq('handle', handle)
                .single();
            if (!error && data) {
                setPerson(rowToPersonDetail(data as Record<string, unknown>));
            } else {
                setPerson(null);
            }
        } catch {
            setPerson(null);
        }
    }, [handle]);

    const fetchPeopleForDialog = useCallback(async () => {
        try {
            const { supabase } = await import('@/lib/supabase');
            const { data, error } = await supabase
                .from('people')
                .select('handle, display_name, gender, birth_year, death_year, is_living, is_privacy_filtered')
                .order('display_name', { ascending: true });
            if (!error && data) {
                setPeopleForDialog(data.map((row: Record<string, unknown>) => ({
                    handle: row.handle as string,
                    displayName: row.display_name as string,
                    gender: row.gender as number,
                    birthYear: row.birth_year as number | undefined,
                    deathYear: row.death_year as number | undefined,
                    isLiving: row.is_living as boolean,
                    isPrivacyFiltered: row.is_privacy_filtered as boolean,
                })));
            }
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            await fetchPerson();
            await fetchPeopleForDialog();
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [handle, fetchPerson, fetchPeopleForDialog]);

    useEffect(() => {
        if (!person) {
            setRelationships(null);
            setEffectiveGeneration(null);
            return;
        }
        setEffectiveGeneration(null);
        let cancelled = false;
        (async () => {
            try {
                const [snap, effGen] = await Promise.all([
                    loadRelationshipSnapshot(
                        person.handle,
                        person.gender,
                        person.parentFamilies || [],
                        person.families || [],
                    ),
                    getEffectiveGeneration(person.handle),
                ]);
                if (!cancelled) {
                    setRelationships(snap);
                    setEffectiveGeneration(effGen);
                }
            } catch {
                if (!cancelled) {
                    setRelationships(null);
                    setEffectiveGeneration(undefined);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [person]);

    function handleDialogOpenChange(open: boolean) {
        setDialogOpen(open);
    }

    async function handleDelete() {
        if (!isAdmin) return;
        if (!window.confirm('Xóa người này? Hành động không thể hoàn tác.')) return;
        setDeleteError(null);
        setDeleting(true);
        const { error } = await deletePerson(handle);
        setDeleting(false);
        if (error) {
            setDeleteError(error);
            return;
        }
        router.push('/people');
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!person) {
        return (
            <div className="text-center py-20">
                <p className="text-muted-foreground">Không tìm thấy người này</p>
                <Button variant="outline" className="mt-4" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại
                </Button>
            </div>
        );
    }

    const genderLabel = person.gender === 1 ? 'Nam' : person.gender === 2 ? 'Nữ' : 'Không rõ';
    const displayGeneration =
        effectiveGeneration === null
            ? person.generation
            : (effectiveGeneration ?? person.generation);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 min-w-0">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            {person.displayName}
                            {person.isPrivacyFiltered && (
                                <Badge variant="outline" className="text-amber-500 border-amber-500">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Thông tin bị giới hạn
                                </Badge>
                            )}
                        </h1>
                        <p className="text-muted-foreground">
                            {genderLabel}
                            {displayGeneration != null
                                ? ` • Đời thứ ${displayGeneration}`
                                : ''}
                            {person.chi ? ` • Chi ${person.chi}` : ''}
                            {person.isLiving && ' • Còn sống'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        disabled={!isAdmin || deleting}
                        title={!isAdmin ? 'Chỉ quản trị viên có thể xóa' : undefined}
                        onClick={() => { void handleDelete(); }}
                    >
                        <Trash2 className="h-4 w-4" />
                        {deleting ? 'Đang xóa...' : 'Xóa'}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setDialogOpen(true)}
                    >
                        <Pencil className="h-4 w-4" />
                        Sửa
                    </Button>
                </div>
            </div>

            {deleteError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {deleteError}
                </div>
            )}

            {/* Privacy notice */}
            {person.isPrivacyFiltered && person._privacyNote && (
                <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-600 dark:text-amber-400">
                    🔒 {person._privacyNote}
                </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview" className="gap-1">
                        <User className="h-3.5 w-3.5" /> Tổng quan
                    </TabsTrigger>
                    <TabsTrigger value="relationships" className="gap-1">
                        <Heart className="h-3.5 w-3.5" /> Quan hệ
                    </TabsTrigger>
                    <TabsTrigger value="media" className="gap-1">
                        <Image className="h-3.5 w-3.5" /> Tư liệu
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-1">
                        <History className="h-3.5 w-3.5" /> Lịch sử
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="gap-1">
                        <MessageCircle className="h-3.5 w-3.5" /> Bình luận
                    </TabsTrigger>
                </TabsList>

                {/* Overview */}
                <TabsContent value="overview" className="space-y-4">
                    {/* Thông tin cá nhân */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <User className="h-4 w-4" /> Thông tin cá nhân
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <InfoRow label="Họ" value={person.surname || '—'} />
                            <InfoRow label="Tên" value={person.firstName || '—'} />
                            <InfoRow label="Giới tính" value={genderLabel} />
                            {person.nickName && <InfoRow label="Tên thường gọi" value={person.nickName} />}
                            <InfoRow label="Ngày sinh" value={person.birthDate || (person.birthYear ? `${person.birthYear}` : '—')} />
                            {person.birthYear && <InfoRow label="Năm âm lịch" value={zodiacYear(person.birthYear) || '—'} />}
                            <InfoRow label="Nơi sinh" value={person.birthPlace || '—'} />
                            {!person.isLiving && (
                                <>
                                    <InfoRow label="Ngày mất" value={person.deathDate || (person.deathYear ? `${person.deathYear}` : '—')} />
                                    <InfoRow label="Nơi mất" value={person.deathPlace || '—'} />
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Liên hệ */}
                    {(person.phone || person.email || person.zalo || person.facebook) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Phone className="h-4 w-4" /> Liên hệ
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                {person.phone && <InfoRow label="Điện thoại" value={person.phone} />}
                                {person.email && <InfoRow label="Email" value={person.email} />}
                                {person.zalo && <InfoRow label="Zalo" value={person.zalo} />}
                                {person.facebook && <InfoRow label="Facebook" value={person.facebook} />}
                            </CardContent>
                        </Card>
                    )}

                    {/* Địa chỉ */}
                    {(person.hometown || person.currentAddress) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <MapPin className="h-4 w-4" /> Địa chỉ
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                {person.hometown && <InfoRow label="Quê quán" value={person.hometown} />}
                                {person.currentAddress && <InfoRow label="Nơi ở hiện tại" value={person.currentAddress} />}
                            </CardContent>
                        </Card>
                    )}

                    {/* Nghề nghiệp & Học vấn */}
                    {(person.occupation || person.company || person.education) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Briefcase className="h-4 w-4" /> Nghề nghiệp & Học vấn
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-2">
                                {person.occupation && <InfoRow label="Nghề nghiệp" value={person.occupation} />}
                                {person.company && <InfoRow label="Nơi công tác" value={person.company} />}
                                {person.education && (
                                    <div className="flex items-start gap-2">
                                        <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground">Học vấn</p>
                                            <p className="text-sm">{person.education}</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Tiểu sử & Ghi chú */}
                    {(person.biography || person.notes) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> Tiểu sử & Ghi chú
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {person.biography && (
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Tiểu sử</p>
                                        <p className="text-sm leading-relaxed">{person.biography}</p>
                                    </div>
                                )}
                                {person.notes && (
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Ghi chú</p>
                                        <p className="text-sm leading-relaxed text-muted-foreground">{person.notes}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Tags */}
                    {person.tags && person.tags.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Tag className="h-4 w-4" /> Nhãn
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {person.tags.map(tag => (
                                        <Badge key={tag} variant="secondary" className="text-xs">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Relationships */}
                <TabsContent value="relationships">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Quan hệ gia đình</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!relationships ? (
                                <p className="text-sm text-muted-foreground">Đang tải quan hệ...</p>
                            ) : (
                                <div className="space-y-5">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-1">Bố</p>
                                            <p className="text-sm">
                                                {relationships.fatherHandle ? (
                                                    <Link
                                                        href={`/people/${relationships.fatherHandle}`}
                                                        className="text-primary hover:underline font-medium"
                                                    >
                                                        {relationships.father}
                                                    </Link>
                                                ) : (
                                                    '—'
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-1">Mẹ</p>
                                            <p className="text-sm">
                                                {relationships.motherHandle ? (
                                                    <Link
                                                        href={`/people/${relationships.motherHandle}`}
                                                        className="text-primary hover:underline font-medium"
                                                    >
                                                        {relationships.mother}
                                                    </Link>
                                                ) : (
                                                    '—'
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-2">Anh chị em</p>
                                        {relationships.siblingsFull.length === 0
                                        && relationships.siblingsFatherOnly.length === 0
                                        && relationships.siblingsMotherOnly.length === 0 ? (
                                            <p className="text-sm">—</p>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap gap-2">
                                                    {relationships.siblingsFull.map((s) => (
                                                        <Badge key={s.handle} variant="outline" className="h-auto max-w-full whitespace-normal py-1.5 text-left font-normal">
                                                            <Link href={`/people/${s.handle}`} className="hover:underline">
                                                                {s.name}
                                                            </Link>
                                                        </Badge>
                                                    ))}
                                                    {relationships.siblingsFatherOnly.map((s) => (
                                                        <Badge
                                                            key={`f-${s.handle}`}
                                                            variant="outline"
                                                            className={cn(
                                                                'h-auto max-w-full whitespace-normal py-1.5 text-left font-normal',
                                                                'border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100',
                                                            )}
                                                            title="Cùng cha khác mẹ"
                                                        >
                                                            <Link href={`/people/${s.handle}`} className="hover:underline">
                                                                {s.name}
                                                            </Link>
                                                        </Badge>
                                                    ))}
                                                    {relationships.siblingsMotherOnly.map((s) => (
                                                        <Badge
                                                            key={`m-${s.handle}`}
                                                            variant="outline"
                                                            className={cn(
                                                                'h-auto max-w-full whitespace-normal py-1.5 text-left font-normal',
                                                                'border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100',
                                                            )}
                                                            title="Cùng mẹ khác cha"
                                                        >
                                                            <Link href={`/people/${s.handle}`} className="hover:underline">
                                                                {s.name}
                                                            </Link>
                                                        </Badge>
                                                    ))}
                                                </div>
                                                {(relationships.siblingsFatherOnly.length > 0 || relationships.siblingsMotherOnly.length > 0) && (
                                                    <p className="text-xs text-muted-foreground">
                                                        <span className="inline-flex items-center gap-1 mr-3">
                                                            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-200 dark:bg-sky-800" />
                                                            Cùng cha khác mẹ
                                                        </span>
                                                        <span className="inline-flex items-center gap-1">
                                                            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-200 dark:bg-rose-800" />
                                                            Cùng mẹ khác cha
                                                        </span>
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <Separator />

                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-2">Vợ/chồng</p>
                                        {relationships.spouses.length === 0 ? (
                                            <p className="text-sm">—</p>
                                        ) : (
                                            <ul className="space-y-1.5 text-sm">
                                                {relationships.spouses.map((s) => (
                                                    <li key={s.handle}>
                                                        <span className="text-muted-foreground">{s.label}: </span>
                                                        <Link href={`/people/${s.handle}`} className="text-primary hover:underline font-medium">
                                                            {s.name}
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-2">Con cái</p>
                                        {relationships.children.length === 0 ? (
                                            <p className="text-sm">—</p>
                                        ) : (
                                            <ul className="space-y-1.5 text-sm">
                                                {relationships.children.map((c) => (
                                                    <li key={c.handle}>
                                                        <span className="text-muted-foreground">{c.label}: </span>
                                                        <Link href={`/people/${c.handle}`} className="text-primary hover:underline font-medium">
                                                            {c.name}
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Media */}
                <TabsContent value="media">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Tư liệu liên quan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-sm">
                                {person.mediaCount ? `${person.mediaCount} tư liệu` : 'Chưa có tư liệu nào'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                                Tính năng xem chi tiết sẽ được bổ sung trong Epic 3 (Media Library).
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* History */}
                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Lịch sử thay đổi</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-sm">
                                Audit log cho entity này sẽ được bổ sung trong Epic 4.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Comments */}
                <TabsContent value="comments">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <MessageCircle className="h-4 w-4" /> Bình luận
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CommentSection personHandle={handle} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <PersonFormDialog
                open={dialogOpen}
                onOpenChange={handleDialogOpenChange}
                people={peopleForDialog}
                targetEditHandle={dialogOpen ? handle : null}
                onSaved={() => {
                    void fetchPerson();
                    void fetchPeopleForDialog();
                }}
            />
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-sm">{value}</p>
        </div>
    );
}
