'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, Plus, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { PersonFormDialog, type PersonFormPerson } from '@/components/person-form-dialog';
import { useAuth } from '@/components/auth-provider';

interface Person extends PersonFormPerson {
    _privacyNote?: string;
}

export default function PeopleListPage() {
    const router = useRouter();
    const { isLoggedIn } = useAuth();
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [genderFilter, setGenderFilter] = useState<number | null>(null);
    const [livingFilter, setLivingFilter] = useState<boolean | null>(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [targetEditHandle, setTargetEditHandle] = useState<string | null>(null);

    const fetchPeople = useCallback(async () => {
        try {
            const { supabase } = await import('@/lib/supabase');
            const { data, error } = await supabase
                .from('people')
                .select('handle, display_name, gender, birth_year, death_year, is_living, is_privacy_filtered')
                .order('display_name', { ascending: true });
            if (!error && data) {
                setPeople(data.map((row: Record<string, unknown>) => ({
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
            await fetchPeople();
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [fetchPeople]);

    function openCreateModal() {
        setTargetEditHandle(null);
        setDialogOpen(true);
    }

    function openEditModal(handle: string) {
        setTargetEditHandle(handle);
        setDialogOpen(true);
    }

    function handleDialogOpenChange(open: boolean) {
        setDialogOpen(open);
        if (!open) setTargetEditHandle(null);
    }

    const filtered = useMemo(() => people.filter((p) => {
        if (search && !p.displayName.toLowerCase().includes(search.toLowerCase())) return false;
        if (genderFilter !== null && p.gender !== genderFilter) return false;
        if (livingFilter !== null && p.isLiving !== livingFilter) return false;
        return true;
    }), [people, search, genderFilter, livingFilter]);

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="h-6 w-6" />
                        Thành viên gia phả
                    </h1>
                    <p className="text-muted-foreground">{people.length} người trong gia phả</p>
                </div>
                {isLoggedIn && (
                    <Button onClick={openCreateModal} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Tạo thành viên
                    </Button>
                )}
            </div>

            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Tìm theo tên..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex gap-2">
                    <Button variant={genderFilter === null ? 'default' : 'outline'} size="sm" onClick={() => setGenderFilter(null)}>Tất cả</Button>
                    <Button variant={genderFilter === 1 ? 'default' : 'outline'} size="sm" onClick={() => setGenderFilter(1)}>Nam</Button>
                    <Button variant={genderFilter === 2 ? 'default' : 'outline'} size="sm" onClick={() => setGenderFilter(2)}>Nữ</Button>
                </div>
                <div className="flex gap-2">
                    <Button variant={livingFilter === null ? 'default' : 'outline'} size="sm" onClick={() => setLivingFilter(null)}>Tất cả</Button>
                    <Button variant={livingFilter === true ? 'default' : 'outline'} size="sm" onClick={() => setLivingFilter(true)}>Còn sống</Button>
                    <Button variant={livingFilter === false ? 'default' : 'outline'} size="sm" onClick={() => setLivingFilter(false)}>Đã mất</Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Họ tên</TableHead>
                                    <TableHead>Giới tính</TableHead>
                                    <TableHead>Năm sinh</TableHead>
                                    <TableHead>Năm mất</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead className="text-right">Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((p) => (
                                    <TableRow
                                        key={p.handle}
                                        className="cursor-pointer hover:bg-accent/50"
                                        onClick={() => router.push(`/people/${p.handle}`)}
                                    >
                                        <TableCell className="font-medium">
                                            {p.displayName}
                                            {p.isPrivacyFiltered && <span className="ml-1 text-amber-500">🔒</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {p.gender === 1 ? 'Nam' : p.gender === 2 ? 'Nữ' : '?'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{p.birthYear || '—'}</TableCell>
                                        <TableCell>{p.deathYear || (p.isLiving ? '—' : '?')}</TableCell>
                                        <TableCell>
                                            <Badge variant={p.isLiving ? 'default' : 'secondary'}>
                                                {p.isLiving ? 'Còn sống' : 'Đã mất'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {isLoggedIn && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={(e) => { e.stopPropagation(); openEditModal(p.handle); }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                    Sửa
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filtered.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            <div className="flex flex-col items-center gap-3">
                                                <span>{search ? 'Không tìm thấy kết quả' : 'Chưa có dữ liệu gia phả'}</span>
                                                {!search && isLoggedIn && (
                                                    <Button onClick={openCreateModal} className="gap-2">
                                                        <Plus className="h-4 w-4" />
                                                        Tạo thành viên đầu tiên
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <PersonFormDialog
                open={dialogOpen}
                onOpenChange={handleDialogOpenChange}
                people={people}
                targetEditHandle={targetEditHandle}
                onSaved={() => { void fetchPeople(); }}
            />
        </div>
    );
}
