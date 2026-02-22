'use client';

import { useState, useCallback, useEffect } from 'react';
import { Shield, Plus, MoreHorizontal, Copy, Check, Link2, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';

const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    editor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    archivist: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    member: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    guest: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

interface ProfileUser {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    status: string;
    created_at: string;
}

interface InviteLink {
    id: string;
    code: string;
    role: string;
    max_uses: number;
    used_count: number;
    created_at: string;
}

function generateCode() {
    const chars = 'abcdef0123456789';
    let code = '';
    for (let i = 0; i < 32; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

export default function AdminUsersPage() {
    const { isAdmin, loading: authLoading } = useAuth();
    const [users, setUsers] = useState<ProfileUser[]>([]);
    const [invites, setInvites] = useState<InviteLink[]>([]);
    const [loading, setLoading] = useState(true);

    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [inviteRole, setInviteRole] = useState('member');
    const [inviteMaxUses, setInviteMaxUses] = useState(1);
    const [copied, setCopied] = useState<string | null>(null);

    // Fetch users from profiles table
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: true });
            if (!error && data) setUsers(data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    // Fetch invite links
    const fetchInvites = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('invite_links')
                .select('*')
                .order('created_at', { ascending: false });
            if (!error && data) setInvites(data);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        if (!authLoading && isAdmin) {
            fetchUsers();
            fetchInvites();
        }
    }, [authLoading, isAdmin, fetchUsers, fetchInvites]);

    // Create invite link
    const handleCreateInvite = useCallback(async () => {
        const code = generateCode();
        const { data, error } = await supabase
            .from('invite_links')
            .insert({
                code,
                role: inviteRole,
                max_uses: inviteMaxUses,
            })
            .select()
            .single();
        if (!error && data) {
            setInvites(prev => [data, ...prev]);
        }
    }, [inviteRole, inviteMaxUses]);

    // Delete invite link
    const handleDeleteInvite = useCallback(async (id: string) => {
        const { error } = await supabase
            .from('invite_links')
            .delete()
            .eq('id', id);
        if (!error) setInvites(prev => prev.filter(inv => inv.id !== id));
    }, []);

    // Change user role
    const handleChangeRole = useCallback(async (userId: string, newRole: string) => {
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);
        if (!error) {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        }
    }, []);

    // Suspend / reactivate user
    const handleToggleStatus = useCallback(async (userId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        const { error } = await supabase
            .from('profiles')
            .update({ status: newStatus })
            .eq('id', userId);
        if (!error) {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
        }
    }, []);

    // Copy to clipboard
    const handleCopy = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(text);
            setTimeout(() => setCopied(null), 2000);
        } catch {
            const input = document.createElement('input');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(text);
            setTimeout(() => setCopied(null), 2000);
        }
    }, []);

    const getInviteUrl = (code: string) => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        return `${baseUrl}/register?code=${code}`;
    };

    const handleCloseDialog = () => {
        setInviteDialogOpen(false);
        setCopied(null);
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-48">
                <p className="text-muted-foreground">Bạn không có quyền truy cập trang này.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Shield className="h-6 w-6" />
                        Quản lý thành viên
                    </h1>
                    <p className="text-muted-foreground">Quản lý tài khoản và quyền truy cập</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => { fetchUsers(); fetchInvites(); }}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Dialog open={inviteDialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setInviteDialogOpen(true); }}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Tạo link mời
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Tạo link mời thành viên</DialogTitle>
                                <DialogDescription>Chọn quyền và tạo link mời cho thành viên mới</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Quyền</label>
                                    <select
                                        className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                                        value={inviteRole}
                                        onChange={e => setInviteRole(e.target.value)}
                                    >
                                        <option value="member">Member — Xem và đề xuất chỉnh sửa</option>
                                        <option value="editor">Editor — Chỉnh sửa trực tiếp</option>
                                        <option value="archivist">Archivist — Quản lý tư liệu</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Số lần dùng tối đa</label>
                                    <Input
                                        type="number"
                                        value={inviteMaxUses}
                                        onChange={e => setInviteMaxUses(Math.max(1, parseInt(e.target.value) || 1))}
                                        min={1}
                                        max={100}
                                    />
                                </div>
                                <Button className="w-full" onClick={handleCreateInvite}>
                                    <Link2 className="mr-2 h-4 w-4" />
                                    Tạo link mời
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Danh sách thành viên</CardTitle>
                    <CardDescription>{users.length} thành viên</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tên</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Quyền</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead>Ngày tham gia</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.display_name || user.email.split('@')[0]}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={ROLE_COLORS[user.role] || ''}>
                                                {user.role.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                                                {user.status === 'active' ? 'Hoạt động' : 'Tạm ngưng'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{new Date(user.created_at).toLocaleDateString('vi-VN')}</TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'admin')}>
                                                        Đặt Admin
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'editor')}>
                                                        Đặt Editor
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'member')}>
                                                        Đặt Member
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className={user.status === 'active' ? 'text-destructive' : 'text-green-600'}
                                                        onClick={() => handleToggleStatus(user.id, user.status)}
                                                    >
                                                        {user.status === 'active' ? 'Tạm ngưng' : 'Kích hoạt lại'}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Invite Links Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Link mời
                    </CardTitle>
                    <CardDescription>{invites.length} link</CardDescription>
                </CardHeader>
                <CardContent>
                    {invites.length === 0 ? (
                        <p className="text-center text-muted-foreground py-6">Chưa có link mời nào</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Link</TableHead>
                                    <TableHead>Quyền</TableHead>
                                    <TableHead>Đã dùng / Tối đa</TableHead>
                                    <TableHead>Ngày tạo</TableHead>
                                    <TableHead className="w-20"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invites.map(inv => (
                                    <TableRow key={inv.id}>
                                        <TableCell>
                                            <code className="text-xs bg-muted px-2 py-1 rounded">
                                                ...?code={inv.code.slice(0, 8)}...
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={ROLE_COLORS[inv.role] || ''}>
                                                {inv.role.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{inv.used_count} / {inv.max_uses}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(inv.created_at).toLocaleDateString('vi-VN')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleCopy(getInviteUrl(inv.code))}
                                                    title="Sao chép link"
                                                >
                                                    {copied === getInviteUrl(inv.code) ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteInvite(inv.id)}
                                                    title="Xóa link"
                                                    className="text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
