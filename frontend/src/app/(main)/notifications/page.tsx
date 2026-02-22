'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';

interface NotificationItem {
    id: string;
    type: string;
    title: string;
    message: string;
    link_url: string | null;
    is_read: boolean;
    created_at: string;
}

const typeIcons: Record<string, string> = {
    NEW_POST: '📝', NEW_COMMENT: '💬', EVENT_REMINDER: '🔔', RSVP_UPDATE: '✅', SYSTEM: '⚙️',
};

export default function NotificationsPage() {
    const router = useRouter();
    const { user, isLoggedIn } = useAuth();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);
        if (data) setNotifications(data);
        setLoading(false);
    }, [user]);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const markAsRead = async (id: string) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    };

    const markAllAsRead = async () => {
        if (!user) return;
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Bell className="h-6 w-6" />Thông báo
                    </h1>
                    <p className="text-muted-foreground">{unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Tất cả đã đọc'}</p>
                </div>
                {unreadCount > 0 && (
                    <Button variant="outline" size="sm" onClick={markAllAsRead}>
                        <CheckCheck className="h-4 w-4 mr-1" />Đánh dấu tất cả đã đọc
                    </Button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            ) : notifications.length === 0 ? (
                <Card><CardContent className="flex flex-col items-center justify-center py-12"><Bell className="h-12 w-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">Chưa có thông báo nào</p></CardContent></Card>
            ) : (
                <div className="space-y-2">
                    {notifications.map(notif => (
                        <Card key={notif.id} className={`cursor-pointer transition-colors ${!notif.is_read ? 'bg-primary/5 border-primary/20' : ''}`}
                            onClick={() => { if (!notif.is_read) markAsRead(notif.id); if (notif.link_url) router.push(notif.link_url); }}>
                            <CardContent className="p-4 flex items-start gap-3">
                                <span className="text-lg">{typeIcons[notif.type] || '📌'}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{notif.title}</span>
                                        {!notif.is_read && <Badge variant="default" className="text-xs">Mới</Badge>}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(notif.created_at).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                {notif.link_url && <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
