'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Image as ImageIcon, Upload, Search, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';

interface MediaItem {
    id: string;
    file_name: string;
    mime_type: string | null;
    file_size: number | null;
    title: string | null;
    description: string | null;
    state: string;
    uploader_id: string | null;
    created_at: string;
    uploader?: { display_name: string | null; email: string };
}

const STATE_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
    PENDING: { variant: 'secondary', label: 'Chờ duyệt' },
    PUBLISHED: { variant: 'default', label: 'Đã duyệt' },
    REJECTED: { variant: 'destructive', label: 'Bị từ chối' },
};

export default function MediaLibraryPage() {
    const { user, isAdmin, isLoggedIn } = useAuth();
    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('all');
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const fetchMedia = useCallback(async (state?: string) => {
        setLoading(true);
        let query = supabase.from('media').select('*, uploader:profiles(display_name, email)').order('created_at', { ascending: false });
        if (state && state !== 'all') query = query.eq('state', state);
        const { data } = await query;
        if (data) setItems(data);
        setLoading(false);
    }, []);

    useEffect(() => { fetchMedia(tab === 'all' ? undefined : tab); }, [tab, fetchMedia]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        setUploading(true);
        try {
            const { error } = await supabase.from('media').insert({
                file_name: file.name,
                mime_type: file.type,
                file_size: file.size,
                state: 'PENDING',
                uploader_id: user.id,
            });
            if (!error) fetchMedia(tab === 'all' ? undefined : tab);
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        const newState = action === 'approve' ? 'PUBLISHED' : 'REJECTED';
        await supabase.from('media').update({ state: newState }).eq('id', id);
        fetchMedia(tab === 'all' ? undefined : tab);
    };

    const formatSize = (bytes: number | null) => {
        if (!bytes) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ImageIcon className="h-6 w-6" />Thư viện</h1>
                    <p className="text-muted-foreground">Quản lý hình ảnh và tài liệu</p>
                </div>
                {isLoggedIn && (
                    <div>
                        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
                        <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                            <Upload className="mr-2 h-4 w-4" />{uploading ? 'Đang tải...' : 'Tải lên'}
                        </Button>
                    </div>
                )}
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    <TabsTrigger value="all">Tất cả</TabsTrigger>
                    <TabsTrigger value="PENDING">Chờ duyệt</TabsTrigger>
                    <TabsTrigger value="PUBLISHED">Đã duyệt</TabsTrigger>
                </TabsList>
            </Tabs>

            {loading ? (
                <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : items.length === 0 ? (
                <Card><CardContent className="flex flex-col items-center justify-center py-12">
                    <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Chưa có tài liệu nào</p>
                </CardContent></Card>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {items.map(item => (
                        <Card key={item.id}>
                            <CardContent className="p-4 space-y-2">
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{item.title || item.file_name}</p>
                                        <p className="text-xs text-muted-foreground">{formatSize(item.file_size)} · {item.mime_type}</p>
                                    </div>
                                    <Badge variant={STATE_BADGE[item.state]?.variant || 'secondary'}>
                                        {STATE_BADGE[item.state]?.label || item.state}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {item.uploader?.display_name || item.uploader?.email?.split('@')[0] || 'Ẩn danh'} · {new Date(item.created_at).toLocaleDateString('vi-VN')}
                                </p>
                                {isAdmin && item.state === 'PENDING' && (
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => handleAction(item.id, 'approve')}>
                                            <Check className="h-3 w-3 mr-1" />Duyệt
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => handleAction(item.id, 'reject')}>
                                            <X className="h-3 w-3 mr-1" />Từ chối
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
