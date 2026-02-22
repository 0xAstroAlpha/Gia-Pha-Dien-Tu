'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Heart, Image, FileText, History, Lock, Phone, MapPin, Briefcase, GraduationCap, Tag, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { zodiacYear } from '@/lib/genealogy-types';
import type { PersonDetail } from '@/lib/genealogy-types';
import { CommentSection } from '@/components/comment-section';


export default function PersonProfilePage() {
    const params = useParams();
    const router = useRouter();
    const handle = params.handle as string;
    const [person, setPerson] = useState<PersonDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPerson = async () => {
            try {
                const { supabase } = await import('@/lib/supabase');
                const { data, error } = await supabase
                    .from('people')
                    .select('*')
                    .eq('handle', handle)
                    .single();
                if (!error && data) {
                    const row = data as Record<string, unknown>;
                    setPerson({
                        handle: row.handle as string,
                        displayName: row.display_name as string,
                        gender: row.gender as number,
                        birthYear: row.birth_year as number | undefined,
                        deathYear: row.death_year as number | undefined,
                        generation: row.generation as number,
                        isLiving: row.is_living as boolean,
                        isPrivacyFiltered: row.is_privacy_filtered as boolean,
                        isPatrilineal: row.is_patrilineal as boolean,
                        families: (row.families as string[]) || [],
                        parentFamilies: (row.parent_families as string[]) || [],
                        phone: row.phone as string | undefined,
                        email: row.email as string | undefined,
                        currentAddress: row.current_address as string | undefined,
                        hometown: row.hometown as string | undefined,
                        occupation: row.occupation as string | undefined,
                        education: row.education as string | undefined,
                        notes: row.notes as string | undefined,
                    } as PersonDetail);
                }
            } catch { /* ignore */ }
            setLoading(false);
        };
        fetchPerson();
    }, [handle]);

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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
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
                            {person.generation ? ` • Đời thứ ${person.generation}` : ''}
                            {person.chi ? ` • Chi ${person.chi}` : ''}
                            {person.isLiving && ' • Còn sống'}
                        </p>
                    </div>
                </div>
            </div>

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
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Gia đình (cha/mẹ)</p>
                                    {person.parentFamilies && person.parentFamilies.length > 0 ? (
                                        person.parentFamilies.map((f) => (
                                            <Badge key={f} variant="outline" className="mr-1">{f}</Badge>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Không có thông tin</p>
                                    )}
                                </div>
                                <Separator />
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Gia đình (vợ/chồng, con)</p>
                                    {person.families && person.families.length > 0 ? (
                                        person.families.map((f) => (
                                            <Badge key={f} variant="outline" className="mr-1">{f}</Badge>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Không có thông tin</p>
                                    )}
                                </div>
                            </div>
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
