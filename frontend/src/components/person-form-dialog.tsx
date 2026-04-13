'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export interface PersonFormPerson {
    handle: string;
    displayName: string;
    gender: number;
    birthYear?: number;
    deathYear?: number;
    isLiving: boolean;
    isPrivacyFiltered: boolean;
}

export interface PersonFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    people: PersonFormPerson[];
    /** null = create new person */
    targetEditHandle: string | null;
    onSaved?: (payload: { handle: string; created: boolean }) => void;
}

export function PersonFormDialog({ open, onOpenChange, people, targetEditHandle, onSaved }: PersonFormDialogProps) {
    const [createSaving, setCreateSaving] = useState(false);
        const [createError, setCreateError] = useState<string | null>(null);
        const [internalEditHandle, setInternalEditHandle] = useState<string | null>(null);
        const [editFamilyHandle, setEditFamilyHandle] = useState<string | null>(null);
        const [editBirthFamilyHandle, setEditBirthFamilyHandle] = useState<string | null>(null);
        const [spouseQuery, setSpouseQuery] = useState('');
        const [childQuery, setChildQuery] = useState('');
        const [fatherQuery, setFatherQuery] = useState('');
        const [motherQuery, setMotherQuery] = useState('');
    const [form, setForm] = useState({
        name: '',
        gender: 1 as 1 | 2,
        birthYear: '',
        deathYear: '',
        fatherHandle: '',
        motherHandle: '',
        spouseHandles: [] as string[],
        childrenHandles: [] as string[],
    });

    async function openCreateModal() {
        setCreateError(null);
        setInternalEditHandle(null);
        setEditFamilyHandle(null);
        setEditBirthFamilyHandle(null);
        setFatherQuery('');
        setMotherQuery('');
        setForm({
            name: '',
            gender: 1,
            birthYear: '',
            deathYear: '',
            fatherHandle: '',
            motherHandle: '',
            spouseHandles: [],
            childrenHandles: [],
        });
    }

    async function openEditModal(handle: string) {
        let person = people.find(p => p.handle === handle);
        if (!person) {
            try {
                const { supabase } = await import('@/lib/supabase');
                const { data, error } = await supabase
                    .from('people')
                    .select('handle, display_name, gender, birth_year, death_year, is_living, is_privacy_filtered')
                    .eq('handle', handle)
                    .single();
                if (!error && data) {
                    const row = data as Record<string, unknown>;
                    person = {
                        handle: row.handle as string,
                        displayName: row.display_name as string,
                        gender: row.gender as number,
                        birthYear: row.birth_year as number | undefined,
                        deathYear: row.death_year as number | undefined,
                        isLiving: row.is_living as boolean,
                        isPrivacyFiltered: row.is_privacy_filtered as boolean,
                    };
                }
            } catch { /* ignore */ }
        }
        if (!person) return;
        setCreateError(null);
        setInternalEditHandle(handle);
            setEditFamilyHandle(null);
            setEditBirthFamilyHandle(null);
            setSpouseQuery('');
            setChildQuery('');
            setFatherQuery('');
            setMotherQuery('');
            setForm({
                name: person.displayName ?? '',
                gender: (person.gender === 2 ? 2 : 1),
                birthYear: person.birthYear ? String(person.birthYear) : '',
                deathYear: person.deathYear ? String(person.deathYear) : '',
                fatherHandle: '',
                motherHandle: '',
                spouseHandles: [],
                childrenHandles: [],
            });

            try {
                const { supabase } = await import('@/lib/supabase');
    
                // Birth family (where this person is a child) → Bố / Mẹ
                const { data: birthRows } = await supabase
                    .from('families')
                    .select('handle, father_handle, mother_handle, children')
                    .contains('children', [handle]);
                const birth = birthRows?.[0];
                if (birth?.handle) {
                    setEditBirthFamilyHandle(birth.handle as string);
                    setForm(prev => ({
                        ...prev,
                        fatherHandle: (birth.father_handle as string) ?? '',
                        motherHandle: (birth.mother_handle as string) ?? '',
                    }));
                }
    
                // Family as parent → spouse + children
                const { data: fam } = await supabase
                    .from('families')
                    .select('handle, father_handle, mother_handle, children')
                    .or(`father_handle.eq.${handle},mother_handle.eq.${handle}`)
                    .limit(1)
                    .maybeSingle();
                if (fam?.handle) {
                    const spouse =
                        fam.father_handle && fam.father_handle !== handle ? fam.father_handle
                            : fam.mother_handle && fam.mother_handle !== handle ? fam.mother_handle
                                : '';
                    setEditFamilyHandle(fam.handle as string);
                    setForm(prev => ({
                        ...prev,
                        spouseHandles: spouse ? [spouse] : [],
                        childrenHandles: Array.isArray(fam.children) ? (fam.children as string[]) : [],
                    }));
                }
            } catch { /* ignore */ }
        }

        async function handleCreatePerson() {
            const name = form.name.trim();
            if (!name) {
                setCreateError('Vui lòng nhập họ tên.');
                return;
            }
    
            const birthYear = form.birthYear.trim() ? parseInt(form.birthYear.trim(), 10) : null;
            const deathYear = form.deathYear.trim() ? parseInt(form.deathYear.trim(), 10) : null;
            if (birthYear !== null && Number.isNaN(birthYear)) {
                setCreateError('Năm sinh không hợp lệ.');
                return;
            }
            if (deathYear !== null && Number.isNaN(deathYear)) {
                setCreateError('Năm mất không hợp lệ.');
                return;
            }
    
            const spouseHandles = [...new Set(form.spouseHandles.filter(Boolean))];
            const childrenHandles = [...new Set(form.childrenHandles.filter(Boolean))];
    
            setCreateSaving(true);
            setCreateError(null);
    
            try {
                const { supabase } = await import('@/lib/supabase');
    
                const personHandle = internalEditHandle ?? `P${Date.now().toString(36).toUpperCase()}`;
                const isCreateMode = !internalEditHandle;
                const isLiving = deathYear ? false : true;
    
                if (internalEditHandle) {
                    const { error: updateError } = await supabase
                        .from('people')
                        .update({
                            display_name: name,
                            gender: form.gender,
                            birth_year: birthYear,
                            death_year: deathYear,
                            is_living: isLiving,
                            is_patrilineal: form.gender === 1,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('handle', personHandle);
                    if (updateError) {
                        setCreateError(updateError.message);
                        return;
                    }
                } else {
                    const { error: insertPersonError } = await supabase
                        .from('people')
                        .insert({
                            handle: personHandle,
                            display_name: name,
                            gender: form.gender,
                            birth_year: birthYear,
                            death_year: deathYear,
                            is_living: isLiving,
                            is_privacy_filtered: false,
                            is_patrilineal: form.gender === 1,
                            families: [],
                            parent_families: [],
                        });
                    if (insertPersonError) {
                        setCreateError(insertPersonError.message);
                        return;
                    }
                }
    
                // ── Bố / Mẹ (gia đình sinh) ──
                const desiredFather = form.fatherHandle.trim() || null;
                const desiredMother = form.motherHandle.trim() || null;
    
                async function syncBirthFamilyLink() {
                    const removeFromFamilyChildren = async (familyHandle: string) => {
                        const { data: famRow } = await supabase
                            .from('families')
                            .select('children')
                            .eq('handle', familyHandle)
                            .single();
                        const ch = (famRow?.children as string[]) ?? [];
                        if (!ch.includes(personHandle)) return;
                        await supabase
                            .from('families')
                            .update({
                                children: ch.filter(c => c !== personHandle),
                                updated_at: new Date().toISOString(),
                            })
                            .eq('handle', familyHandle);
                    };
    
                    // Unchanged birth parents → only ensure links, do not unlink
                    if (editBirthFamilyHandle && (desiredFather || desiredMother)) {
                        const { data: curBirth } = await supabase
                            .from('families')
                            .select('father_handle, mother_handle, children')
                            .eq('handle', editBirthFamilyHandle)
                            .single();
                        if (
                            curBirth &&
                            (curBirth.father_handle ?? null) === (desiredFather ?? null) &&
                            (curBirth.mother_handle ?? null) === (desiredMother ?? null)
                        ) {
                            const ch = (curBirth.children as string[]) ?? [];
                            if (!ch.includes(personHandle)) {
                                await supabase
                                    .from('families')
                                    .update({
                                        children: [...ch, personHandle],
                                        updated_at: new Date().toISOString(),
                                    })
                                    .eq('handle', editBirthFamilyHandle);
                            }
                            const { data: pRow } = await supabase
                                .from('people')
                                .select('parent_families')
                                .eq('handle', personHandle)
                                .single();
                            let pf = (pRow?.parent_families as string[]) ?? [];
                            if (!pf.includes(editBirthFamilyHandle)) {
                                pf = [...pf, editBirthFamilyHandle];
                                await supabase.from('people').update({ parent_families: pf }).eq('handle', personHandle);
                            }
                            return;
                        }
                    }
    
                    const { data: personRow } = await supabase
                        .from('people')
                        .select('parent_families')
                        .eq('handle', personHandle)
                        .single();
                    let parentFamilies = (personRow?.parent_families as string[]) ?? [];
    
                    if (editBirthFamilyHandle) {
                        parentFamilies = parentFamilies.filter(f => f !== editBirthFamilyHandle);
                        await removeFromFamilyChildren(editBirthFamilyHandle);
                    }
    
                    if (!desiredFather && !desiredMother) {
                        await supabase.from('people').update({ parent_families: parentFamilies }).eq('handle', personHandle);
                        return;
                    }
    
                    const { data: allFamilies } = await supabase
                        .from('families')
                        .select('handle, father_handle, mother_handle, children');
    
                    const match = (allFamilies ?? []).find(f =>
                        (f.father_handle ?? null) === (desiredFather ?? null) &&
                        (f.mother_handle ?? null) === (desiredMother ?? null)
                    );
    
                    let targetFamilyHandle: string;
                    if (match?.handle) {
                        targetFamilyHandle = match.handle as string;
                        const ch = (match.children as string[]) ?? [];
                        if (!ch.includes(personHandle)) {
                            await supabase
                                .from('families')
                                .update({
                                    children: [...ch, personHandle],
                                    updated_at: new Date().toISOString(),
                                })
                                .eq('handle', targetFamilyHandle);
                        }
                    } else {
                        targetFamilyHandle = `F${Date.now().toString(36).toUpperCase()}`;
                        const { error: insErr } = await supabase.from('families').insert({
                            handle: targetFamilyHandle,
                            father_handle: desiredFather,
                            mother_handle: desiredMother,
                            children: [personHandle],
                        });
                        if (insErr) {
                            setCreateError(insErr.message);
                            throw new Error(insErr.message);
                        }
                    }
    
                    if (!parentFamilies.includes(targetFamilyHandle)) {
                        parentFamilies = [...parentFamilies, targetFamilyHandle];
                    }
                    await supabase.from('people').update({ parent_families: parentFamilies }).eq('handle', personHandle);
                }
    
                try {
                    await syncBirthFamilyLink();
                } catch {
                    return;
                }
    
                // ── Hôn nhân + Con cái ──
                // Model: each spouse relationship is a family record. Children are attached to the "primary" family
                // (with the first selected spouse; or single-parent family if no spouse).
                const wantsPrimaryFamily = spouseHandles.length > 0 || childrenHandles.length > 0;
                const createdFamilyHandles: string[] = [];
    
                // Helper: upsert person's families array with union
                async function addFamilyToPersonFamilies(targetHandle: string, familyHandle: string) {
                    const { data: row } = await supabase
                        .from('people')
                        .select('families')
                        .eq('handle', targetHandle)
                        .single();
                    const current = (row?.families as string[]) ?? [];
                    if (!current.includes(familyHandle)) {
                        await supabase.from('people').update({ families: [...current, familyHandle] }).eq('handle', targetHandle);
                    }
                }
    
                async function addFamilyToChildParentFamilies(childHandle: string, familyHandle: string) {
                    const { data: row } = await supabase
                        .from('people')
                        .select('parent_families')
                        .eq('handle', childHandle)
                        .single();
                    const current = (row?.parent_families as string[]) ?? [];
                    if (!current.includes(familyHandle)) {
                        await supabase.from('people').update({ parent_families: [...current, familyHandle] }).eq('handle', childHandle);
                    }
                }
    
                if (wantsPrimaryFamily) {
                    const primarySpouseHandle = spouseHandles[0] ?? '';
                    const primaryFamilyHandle = editFamilyHandle ?? `F${Date.now().toString(36).toUpperCase()}`;
    
                    // When editing an existing family, remove link from previous spouse if spouse changed
                    if (editFamilyHandle) {
                        const { data: oldFam } = await supabase
                            .from('families')
                            .select('father_handle, mother_handle')
                            .eq('handle', primaryFamilyHandle)
                            .single();
                        const oldSpouse =
                            oldFam?.father_handle && oldFam.father_handle !== personHandle ? oldFam.father_handle
                                : oldFam?.mother_handle && oldFam.mother_handle !== personHandle ? oldFam.mother_handle
                                    : null;
                        if (oldSpouse && oldSpouse !== primarySpouseHandle) {
                            const { data: oldSpouseRow } = await supabase
                                .from('people')
                                .select('families')
                                .eq('handle', oldSpouse)
                                .single();
                            const cur = (oldSpouseRow?.families as string[]) ?? [];
                            if (cur.includes(primaryFamilyHandle)) {
                                await supabase
                                    .from('people')
                                    .update({ families: cur.filter(f => f !== primaryFamilyHandle) })
                                    .eq('handle', oldSpouse);
                            }
                        }
                    }
    
                    const spouse = primarySpouseHandle ? people.find(p => p.handle === primarySpouseHandle) : undefined;
                    const fatherHandle =
                        (form.gender === 1 ? personHandle : undefined) ??
                        (spouse?.gender === 1 ? primarySpouseHandle : undefined);
                    const motherHandle =
                        (form.gender === 2 ? personHandle : undefined) ??
                        (spouse?.gender === 2 ? primarySpouseHandle : undefined);
    
                    if (editFamilyHandle) {
                        const { error } = await supabase
                            .from('families')
                            .update({
                                father_handle: fatherHandle ?? null,
                                mother_handle: motherHandle ?? null,
                                children: childrenHandles,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('handle', primaryFamilyHandle);
                        if (error) {
                            setCreateError(error.message);
                            return;
                        }
                    } else {
                        const { error } = await supabase
                            .from('families')
                            .insert({
                                handle: primaryFamilyHandle,
                                father_handle: fatherHandle ?? null,
                                mother_handle: motherHandle ?? null,
                                children: childrenHandles,
                            });
                        if (error) {
                            setCreateError(error.message);
                            return;
                        }
                    }
    
                    createdFamilyHandles.push(primaryFamilyHandle);
                    await addFamilyToPersonFamilies(personHandle, primaryFamilyHandle);
                    if (primarySpouseHandle) await addFamilyToPersonFamilies(primarySpouseHandle, primaryFamilyHandle);
                    for (const ch of childrenHandles) await addFamilyToChildParentFamilies(ch, primaryFamilyHandle);
    
                    // Additional spouses → create extra family records (no children)
                    for (const extraSpouse of spouseHandles.slice(1)) {
                        const famHandle = `F${(Date.now() + Math.floor(Math.random() * 10000)).toString(36).toUpperCase()}`;
                        const extra = people.find(p => p.handle === extraSpouse);
                        const fH =
                            (form.gender === 1 ? personHandle : undefined) ??
                            (extra?.gender === 1 ? extraSpouse : undefined);
                        const mH =
                            (form.gender === 2 ? personHandle : undefined) ??
                            (extra?.gender === 2 ? extraSpouse : undefined);
    
                        const { error } = await supabase
                            .from('families')
                            .insert({
                                handle: famHandle,
                                father_handle: fH ?? null,
                                mother_handle: mH ?? null,
                                children: [],
                            });
                        if (error) {
                            setCreateError(error.message);
                            return;
                        }
                        createdFamilyHandles.push(famHandle);
                        await addFamilyToPersonFamilies(personHandle, famHandle);
                        await addFamilyToPersonFamilies(extraSpouse, famHandle);
                    }
                }
    
                onOpenChange(false);
                setInternalEditHandle(null);
                setEditFamilyHandle(null);
                setForm({
                    name: '',
                    gender: 1,
                    birthYear: '',
                    deathYear: '',
                    fatherHandle: '',
                    motherHandle: '',
                    spouseHandles: [],
                    childrenHandles: [],
                });
                setEditBirthFamilyHandle(null);
                onSaved?.({ handle: personHandle, created: isCreateMode });
    
            } catch (e) {
                setCreateError(e instanceof Error ? e.message : 'Không thể tạo thành viên.');
            } finally {
                setCreateSaving(false);
            }
        }

        /** Bố / Mẹ: không hiển thị chính mình, vợ/chồng đã chọn, và con đã chọn */
        const excludedFromParentPickers = useMemo(() => {
            const s = new Set<string>();
            if (internalEditHandle) s.add(internalEditHandle);
            form.spouseHandles.forEach(h => s.add(h));
            form.childrenHandles.forEach(h => s.add(h));
            return s;
        }, [internalEditHandle, form.spouseHandles, form.childrenHandles]);
    
        /** Hôn nhân: không hiển thị chính mình, con đã chọn, bố/mẹ — vẫn hiển thị vợ/chồng đã chọn để bỏ chọn */
        const excludedFromSpousePicker = useMemo(() => {
            const s = new Set<string>();
            if (internalEditHandle) s.add(internalEditHandle);
            form.childrenHandles.forEach(h => s.add(h));
            if (form.fatherHandle) s.add(form.fatherHandle);
            if (form.motherHandle) s.add(form.motherHandle);
            return s;
        }, [internalEditHandle, form.childrenHandles, form.fatherHandle, form.motherHandle]);
    
        /** Con cái: không hiển thị chính mình, vợ/chồng đã chọn, bố/mẹ — vẫn hiển thị con đã chọn để bỏ chọn */
        const excludedFromChildPicker = useMemo(() => {
            const s = new Set<string>();
            if (internalEditHandle) s.add(internalEditHandle);
            form.spouseHandles.forEach(h => s.add(h));
            if (form.fatherHandle) s.add(form.fatherHandle);
            if (form.motherHandle) s.add(form.motherHandle);
            return s;
        }, [internalEditHandle, form.spouseHandles, form.fatherHandle, form.motherHandle]);

    useEffect(() => {
        if (!open) return;
        if (targetEditHandle) {
            void openEditModal(targetEditHandle);
        } else {
            openCreateModal();
        }
    }, [open, targetEditHandle]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                onOpenChange(o);
                if (!o) {
                    setCreateError(null);
                    setInternalEditHandle(null);
                    setEditFamilyHandle(null);
                    setEditBirthFamilyHandle(null);
                    setSpouseQuery('');
                    setChildQuery('');
                    setFatherQuery('');
                    setMotherQuery('');
                }
            }}
        >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{(targetEditHandle ?? internalEditHandle) ? 'Sửa thành viên' : 'Tạo thành viên'}</DialogTitle>
                        </DialogHeader>
    
                        <div className="grid gap-3">
                            <div className="grid gap-1.5">
                                <label className="text-sm font-medium">Họ tên</label>
                                <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nguyễn Văn A" />
                            </div>
    
                            <div className="grid gap-1.5">
                                <label className="text-sm font-medium">Giới tính</label>
                                <div className="flex gap-2">
                                    <Button type="button" variant={form.gender === 1 ? 'default' : 'outline'} size="sm"
                                        onClick={() => setForm(f => ({ ...f, gender: 1 }))}>
                                        Nam
                                    </Button>
                                    <Button type="button" variant={form.gender === 2 ? 'default' : 'outline'} size="sm"
                                        onClick={() => setForm(f => ({ ...f, gender: 2 }))}>
                                        Nữ
                                    </Button>
                                </div>
                            </div>
    
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                    <label className="text-sm font-medium">Năm sinh</label>
                                    <Input inputMode="numeric" value={form.birthYear} onChange={(e) => setForm(f => ({ ...f, birthYear: e.target.value }))} placeholder="1990" />
                                </div>
                                <div className="grid gap-1.5">
                                    <label className="text-sm font-medium">Năm mất</label>
                                    <Input inputMode="numeric" value={form.deathYear} onChange={(e) => setForm(f => ({ ...f, deathYear: e.target.value }))} placeholder="—" />
                                </div>
                            </div>
    
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                    <label className="text-sm font-medium">Bố</label>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button type="button" variant="outline" className="justify-between">
                                                <span className="truncate">
                                                    {form.fatherHandle
                                                        ? (people.find(p => p.handle === form.fatherHandle)?.displayName ?? form.fatherHandle)
                                                        : <span className="text-muted-foreground">—</span>}
                                                </span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-[320px] max-w-[calc(100vw-3rem)]">
                                            <DropdownMenuLabel>Bố</DropdownMenuLabel>
                                            <div className="px-2 pb-2">
                                                <Input
                                                    value={fatherQuery}
                                                    onChange={(e) => setFatherQuery(e.target.value)}
                                                    placeholder="Tìm theo tên hoặc handle..."
                                                    className="h-8"
                                                />
                                            </div>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuRadioGroup
                                                value={form.fatherHandle || '__none__'}
                                                onValueChange={(v) => setForm(f => ({ ...f, fatherHandle: v === '__none__' ? '' : v }))}
                                            >
                                                <DropdownMenuRadioItem value="__none__">Không chọn</DropdownMenuRadioItem>
                                                {people
                                                    .filter(p => p.gender === 1)
                                                    .filter(p => !excludedFromParentPickers.has(p.handle))
                                                    .filter(p => {
                                                        const q = fatherQuery.trim().toLowerCase();
                                                        if (!q) return true;
                                                        return p.displayName.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q);
                                                    })
                                                    .slice(0, 120)
                                                    .map(p => (
                                                        <DropdownMenuRadioItem key={p.handle} value={p.handle}>
                                                            <span className="truncate">{p.displayName}</span>
                                                            <span className="text-xs text-muted-foreground ml-1">{p.handle}</span>
                                                        </DropdownMenuRadioItem>
                                                    ))}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div className="grid gap-1.5">
                                    <label className="text-sm font-medium">Mẹ</label>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button type="button" variant="outline" className="justify-between">
                                                <span className="truncate">
                                                    {form.motherHandle
                                                        ? (people.find(p => p.handle === form.motherHandle)?.displayName ?? form.motherHandle)
                                                        : <span className="text-muted-foreground">—</span>}
                                                </span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-[320px] max-w-[calc(100vw-3rem)]">
                                            <DropdownMenuLabel>Mẹ</DropdownMenuLabel>
                                            <div className="px-2 pb-2">
                                                <Input
                                                    value={motherQuery}
                                                    onChange={(e) => setMotherQuery(e.target.value)}
                                                    placeholder="Tìm theo tên hoặc handle..."
                                                    className="h-8"
                                                />
                                            </div>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuRadioGroup
                                                value={form.motherHandle || '__none__'}
                                                onValueChange={(v) => setForm(f => ({ ...f, motherHandle: v === '__none__' ? '' : v }))}
                                            >
                                                <DropdownMenuRadioItem value="__none__">Không chọn</DropdownMenuRadioItem>
                                                {people
                                                    .filter(p => p.gender === 2)
                                                    .filter(p => !excludedFromParentPickers.has(p.handle))
                                                    .filter(p => {
                                                        const q = motherQuery.trim().toLowerCase();
                                                        if (!q) return true;
                                                        return p.displayName.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q);
                                                    })
                                                    .slice(0, 120)
                                                    .map(p => (
                                                        <DropdownMenuRadioItem key={p.handle} value={p.handle}>
                                                            <span className="truncate">{p.displayName}</span>
                                                            <span className="text-xs text-muted-foreground ml-1">{p.handle}</span>
                                                        </DropdownMenuRadioItem>
                                                    ))}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
    
                            <div className="grid gap-1.5">
                                <label className="text-sm font-medium">Hôn nhân</label>
                                <div className="rounded-md border border-input bg-background p-2 space-y-2">
                                    <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                                        {form.spouseHandles.length === 0 ? (
                                            <span className="text-sm text-muted-foreground">—</span>
                                        ) : (
                                            form.spouseHandles.map(h => {
                                                const label = people.find(p => p.handle === h)?.displayName ?? h;
                                                return (
                                                    <Badge
                                                        key={h}
                                                        variant="secondary"
                                                        className="gap-1 pl-2 pr-1 py-0.5 font-normal max-w-full"
                                                    >
                                                        <span className="truncate">{label}</span>
                                                        <button
                                                            type="button"
                                                            className="rounded-sm p-0.5 hover:bg-muted shrink-0"
                                                            aria-label={`Bỏ chọn ${label}`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setForm(f => ({ ...f, spouseHandles: f.spouseHandles.filter(x => x !== h) }));
                                                            }}
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </Badge>
                                                );
                                            })
                                        )}
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button type="button" variant="outline" size="sm" className="w-full justify-start">
                                                Chọn hoặc bỏ chọn trong danh sách
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-[420px] max-w-[calc(100vw-3rem)]">
                                            <DropdownMenuLabel>Hôn nhân</DropdownMenuLabel>
                                            <div className="px-2 pb-2">
                                                <Input
                                                    value={spouseQuery}
                                                    onChange={(e) => setSpouseQuery(e.target.value)}
                                                    placeholder="Tìm theo tên hoặc handle..."
                                                    className="h-8"
                                                />
                                            </div>
                                            <DropdownMenuSeparator />
                                            {people
                                                .filter(p => !excludedFromSpousePicker.has(p.handle))
                                                .filter(p => {
                                                    const q = spouseQuery.trim().toLowerCase();
                                                    if (!q) return true;
                                                    return p.displayName.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q);
                                                })
                                                .slice(0, 120)
                                                .map(p => (
                                                    <DropdownMenuCheckboxItem
                                                        key={p.handle}
                                                        checked={form.spouseHandles.includes(p.handle)}
                                                        onCheckedChange={(checked) => {
                                                            setForm(f => {
                                                                const next = new Set(f.spouseHandles);
                                                                if (checked) next.add(p.handle); else next.delete(p.handle);
                                                                return { ...f, spouseHandles: Array.from(next) };
                                                            });
                                                        }}
                                                    >
                                                        <span className="truncate flex-1">{p.displayName}</span>
                                                        <span className="text-xs text-muted-foreground">{p.handle}</span>
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                            {people.length === 0 && (
                                                <div className="px-2 py-2 text-sm text-muted-foreground">Chưa có thành viên để chọn.</div>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
    
                            <div className="grid gap-1.5">
                                <label className="text-sm font-medium">Con cái</label>
                                <div className="rounded-md border border-input bg-background p-2 space-y-2">
                                    <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                                        {form.childrenHandles.length === 0 ? (
                                            <span className="text-sm text-muted-foreground">—</span>
                                        ) : (
                                            form.childrenHandles.map(h => {
                                                const label = people.find(p => p.handle === h)?.displayName ?? h;
                                                return (
                                                    <Badge
                                                        key={h}
                                                        variant="secondary"
                                                        className="gap-1 pl-2 pr-1 py-0.5 font-normal max-w-full"
                                                    >
                                                        <span className="truncate">{label}</span>
                                                        <button
                                                            type="button"
                                                            className="rounded-sm p-0.5 hover:bg-muted shrink-0"
                                                            aria-label={`Bỏ chọn ${label}`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setForm(f => ({ ...f, childrenHandles: f.childrenHandles.filter(x => x !== h) }));
                                                            }}
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </Badge>
                                                );
                                            })
                                        )}
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button type="button" variant="outline" size="sm" className="w-full justify-start">
                                                Chọn hoặc bỏ chọn trong danh sách
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-[420px] max-w-[calc(100vw-3rem)]">
                                            <DropdownMenuLabel>Con cái</DropdownMenuLabel>
                                            <div className="px-2 pb-2">
                                                <Input
                                                    value={childQuery}
                                                    onChange={(e) => setChildQuery(e.target.value)}
                                                    placeholder="Tìm theo tên hoặc handle..."
                                                    className="h-8"
                                                />
                                            </div>
                                            <DropdownMenuSeparator />
                                            {people
                                                .filter(p => !excludedFromChildPicker.has(p.handle))
                                                .filter(p => {
                                                    const q = childQuery.trim().toLowerCase();
                                                    if (!q) return true;
                                                    return p.displayName.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q);
                                                })
                                                .slice(0, 160)
                                                .map(p => (
                                                    <DropdownMenuCheckboxItem
                                                        key={p.handle}
                                                        checked={form.childrenHandles.includes(p.handle)}
                                                        onCheckedChange={(checked) => {
                                                            setForm(f => {
                                                                const next = new Set(f.childrenHandles);
                                                                if (checked) next.add(p.handle); else next.delete(p.handle);
                                                                return { ...f, childrenHandles: Array.from(next) };
                                                            });
                                                        }}
                                                    >
                                                        <span className="truncate flex-1">{p.displayName}</span>
                                                        <span className="text-xs text-muted-foreground">{p.handle}</span>
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                            {people.length === 0 && (
                                                <div className="px-2 py-2 text-sm text-muted-foreground">Chưa có thành viên để chọn.</div>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
    
                            {createError && (
                                <div className="text-sm text-red-600">{createError}</div>
                            )}
                        </div>
    
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createSaving}>
                                Hủy
                            </Button>
                            <Button type="button" onClick={handleCreatePerson} disabled={createSaving}>
                                {createSaving
                                    ? ((targetEditHandle ?? internalEditHandle) ? 'Đang lưu...' : 'Đang tạo...')
                                    : ((targetEditHandle ?? internalEditHandle) ? 'Lưu' : 'Tạo')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
    );
}

