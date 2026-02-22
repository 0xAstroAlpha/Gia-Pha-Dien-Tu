'use client';

import { useEffect, useState, useCallback } from 'react';
import { Send, Trash2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';

interface Comment {
    id: string;
    author_id: string;
    author_email: string;
    author_name: string;
    content: string;
    created_at: string;
}

interface CommentSectionProps {
    personHandle: string;
}

export function CommentSection({ personHandle }: CommentSectionProps) {
    const { user, profile, isAdmin, isLoggedIn } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);

    const fetchComments = useCallback(async () => {
        const { data } = await supabase
            .from('comments')
            .select('*')
            .eq('person_handle', personHandle)
            .order('created_at', { ascending: true });
        setComments((data as Comment[]) || []);
        setLoading(false);
    }, [personHandle]);

    useEffect(() => { fetchComments(); }, [fetchComments]);

    const handleSubmit = async () => {
        if (!content.trim() || !user) return;
        setSending(true);
        await supabase.from('comments').insert({
            author_id: user.id,
            author_email: profile?.email || user.email || '',
            author_name: profile?.display_name || user.email?.split('@')[0] || 'Ẩn danh',
            person_handle: personHandle,
            content: content.trim(),
        });
        setContent('');
        setSending(false);
        fetchComments();
    };

    const handleDelete = async (commentId: string) => {
        await supabase.from('comments').delete().eq('id', commentId);
        fetchComments();
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'vừa xong';
        if (mins < 60) return `${mins} phút trước`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} giờ trước`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days} ngày trước`;
        return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    return (
        <div className="space-y-4">
            {/* Comment list */}
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                </div>
            ) : comments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Chưa có bình luận nào</p>
                    <p className="text-xs mt-1">Hãy là người đầu tiên bình luận!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {comments.map(c => (
                        <div key={c.id} className="flex gap-3 group">
                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                                {c.author_name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'}
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{c.author_name}</span>
                                    <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                                    {/* Delete button */}
                                    {(isAdmin || (user && user.id === c.author_id)) && (
                                        <button
                                            onClick={() => handleDelete(c.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                            title="Xóa bình luận"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{c.content}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Comment input */}
            {isLoggedIn ? (
                <div className="flex gap-2 pt-2 border-t">
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="Viết bình luận..."
                        className="flex-1 rounded-lg border px-3 py-2 text-sm bg-background resize-none min-h-[40px] max-h-[120px]"
                        rows={1}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                    />
                    <Button size="sm" disabled={!content.trim() || sending} onClick={handleSubmit} className="self-end">
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            ) : (
                <div className="text-center py-3 border-t text-xs text-muted-foreground">
                    <a href="/login" className="text-primary underline">Đăng nhập</a> để bình luận
                </div>
            )}
        </div>
    );
}
