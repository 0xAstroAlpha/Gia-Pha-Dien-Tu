'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';

export function NotificationBell() {
    const router = useRouter();
    const { user, isLoggedIn } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!isLoggedIn || !user) return;

        const fetchCount = async () => {
            try {
                const { count } = await supabase
                    .from('notifications')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('is_read', false);
                setUnreadCount(count || 0);
            } catch { /* ignore */ }
        };

        fetchCount();
        const interval = setInterval(fetchCount, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [isLoggedIn, user]);

    return (
        <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => router.push('/notifications')}
        >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </Button>
    );
}
