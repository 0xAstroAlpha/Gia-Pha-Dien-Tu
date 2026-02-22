'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CalendarDays, MapPin, Clock, Users, ArrowLeft, Check, X, HelpCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';

const typeLabels: Record<string, { label: string; emoji: string }> = {
    MEMORIAL: { label: 'Giỗ', emoji: '🕯️' },
    MEETING: { label: 'Họp họ', emoji: '🤝' },
    FESTIVAL: { label: 'Lễ hội', emoji: '🎊' },
    OTHER: { label: 'Khác', emoji: '📅' },
};

const rsvpOptions = [
    { status: 'GOING', label: 'Tham dự', icon: Check, variant: 'default' as const },
    { status: 'MAYBE', label: 'Có thể', icon: HelpCircle, variant: 'secondary' as const },
    { status: 'NOT_GOING', label: 'Không đi', icon: X, variant: 'destructive' as const },
];

export default function EventDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isLoggedIn } = useAuth();
    const [event, setEvent] = useState<Record<string, unknown> | null>(null);
    const [rsvps, setRsvps] = useState<Record<string, unknown>[]>([]);
    const [myRsvp, setMyRsvp] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchEvent = useCallback(async () => {
        if (!params.id) return;
        setLoading(true);
        try {
            const { data } = await supabase
                .from('events')
                .select('*, creator:profiles(display_name, email)')
                .eq('id', params.id)
                .single();
            if (data) setEvent(data);

            // Fetch RSVPs
            const { data: rsvpData } = await supabase
                .from('event_rsvps')
                .select('*, user:profiles(display_name, email)')
                .eq('event_id', params.id);
            if (rsvpData) {
                setRsvps(rsvpData);
                if (user) {
                    const mine = rsvpData.find((r: Record<string, unknown>) => r.user_id === user.id);
                    if (mine) setMyRsvp(mine.status as string);
                }
            }
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [params.id, user]);

    useEffect(() => { fetchEvent(); }, [fetchEvent]);

    const handleRsvp = async (status: string) => {
        if (!user || !params.id) return;
        const { error } = await supabase
            .from('event_rsvps')
            .upsert({ event_id: params.id, user_id: user.id, status }, { onConflict: 'event_id,user_id' });
        if (!error) {
            setMyRsvp(status);
            fetchEvent();
        }
    };

    if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!event) return <div className="text-center py-12 text-muted-foreground">Không tìm thấy sự kiện</div>;

    const tl = typeLabels[(event.type as string)] || typeLabels.OTHER;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <Button variant="ghost" size="sm" onClick={() => router.push('/events')}>
                <ArrowLeft className="mr-2 h-4 w-4" />Quay lại
            </Button>

            <Card>
                <CardHeader>
                    <Badge variant="secondary" className="w-fit">{tl.emoji} {tl.label}</Badge>
                    <CardTitle className="text-2xl">{event.title as string}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {typeof event.description === 'string' && event.description && <p className="text-muted-foreground">{event.description}</p>}
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2"><Clock className="h-4 w-4" />{new Date(event.start_at as string).toLocaleString('vi-VN')}</div>
                        {typeof event.location === 'string' && event.location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{event.location}</div>}
                        <div className="flex items-center gap-2"><Users className="h-4 w-4" />{rsvps.filter((r: Record<string, unknown>) => r.status === 'GOING').length} người tham dự</div>
                    </div>

                    {isLoggedIn && (
                        <div className="flex gap-2 pt-4 border-t">
                            {rsvpOptions.map(opt => (
                                <Button
                                    key={opt.status}
                                    variant={myRsvp === opt.status ? opt.variant : 'outline'}
                                    size="sm"
                                    onClick={() => handleRsvp(opt.status)}
                                >
                                    <opt.icon className="mr-1 h-4 w-4" />{opt.label}
                                </Button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {rsvps.length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="text-base">Danh sách phản hồi</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {rsvps.map((r: Record<string, unknown>) => (
                                <div key={r.id as string} className="flex items-center justify-between text-sm">
                                    <span>{(r.user as Record<string, unknown>)?.display_name as string || ((r.user as Record<string, unknown>)?.email as string)?.split('@')[0]}</span>
                                    <Badge variant="secondary">{r.status as string}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
