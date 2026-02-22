'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    CalendarDays,
    MapPin,
    Clock,
    Users,
    Plus,
    ChevronLeft,
    ChevronRight,
    Check,
    X,
    HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';

interface EventItem {
    id: string;
    title: string;
    description: string | null;
    start_at: string;
    end_at: string | null;
    location: string | null;
    type: string;
    is_recurring: boolean;
    creator_id: string;
    created_at: string;
    creator?: { display_name: string | null; email: string };
    rsvp_count?: number;
}

const typeLabels: Record<string, { label: string; emoji: string }> = {
    MEMORIAL: { label: 'Giỗ', emoji: '🕯️' },
    MEETING: { label: 'Họp họ', emoji: '🤝' },
    FESTIVAL: { label: 'Lễ hội', emoji: '🎊' },
    OTHER: { label: 'Khác', emoji: '📅' },
};

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
}

function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('vi-VN', {
        hour: '2-digit', minute: '2-digit',
    });
}

function CreateEventDialog({ onCreated }: { onCreated: () => void }) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startAt, setStartAt] = useState('');
    const [location, setLocation] = useState('');
    const [type, setType] = useState('MEETING');

    const handleSubmit = async () => {
        if (!title.trim() || !startAt || !user) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.from('events').insert({
                title: title.trim(),
                description: description.trim() || null,
                start_at: new Date(startAt).toISOString(),
                location: location.trim() || null,
                type,
                creator_id: user.id,
            });
            if (!error) {
                setOpen(false);
                setTitle(''); setDescription(''); setStartAt(''); setLocation('');
                onCreated();
            }
        } finally { setSubmitting(false); }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Tạo sự kiện</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Tạo sự kiện mới</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                    <Input placeholder="Tên sự kiện *" value={title} onChange={e => setTitle(e.target.value)} />
                    <Textarea placeholder="Mô tả" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                    <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
                    <Input placeholder="Địa điểm" value={location} onChange={e => setLocation(e.target.value)} />
                    <select className="w-full rounded-md border px-3 py-2 text-sm bg-background" value={type} onChange={e => setType(e.target.value)}>
                        {Object.entries(typeLabels).map(([k, v]) => (
                            <option key={k} value={k}>{v.emoji} {v.label}</option>
                        ))}
                    </select>
                    <Button className="w-full" onClick={handleSubmit} disabled={!title.trim() || !startAt || submitting}>
                        {submitting ? 'Đang tạo...' : 'Tạo sự kiện'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function EventCard({ event }: { event: EventItem }) {
    const router = useRouter();
    const tl = typeLabels[event.type] || typeLabels.OTHER;

    return (
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/events/${event.id}`)}>
            <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                    <div>
                        <Badge variant="secondary" className="text-xs mb-1">{tl.emoji} {tl.label}</Badge>
                        <h3 className="font-semibold">{event.title}</h3>
                    </div>
                    {event.rsvp_count !== undefined && event.rsvp_count > 0 && (
                        <Badge variant="outline"><Users className="h-3 w-3 mr-1" />{event.rsvp_count}</Badge>
                    )}
                </div>
                {event.description && <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(event.start_at)} · {formatTime(event.start_at)}</span>
                    {event.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location}</span>}
                </div>
            </CardContent>
        </Card>
    );
}

export default function EventsPage() {
    const { isLoggedIn } = useAuth();
    const [events, setEvents] = useState<EventItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('events')
                .select('*, creator:profiles(display_name, email)')
                .order('start_at', { ascending: false });
            if (data) setEvents(data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <CalendarDays className="h-6 w-6" />
                        Sự kiện
                    </h1>
                    <p className="text-muted-foreground">Lịch các hoạt động dòng họ</p>
                </div>
                {isLoggedIn && <CreateEventDialog onCreated={fetchEvents} />}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : events.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Chưa có sự kiện nào</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {events.map(event => <EventCard key={event.id} event={event} />)}
                </div>
            )}
        </div>
    );
}
