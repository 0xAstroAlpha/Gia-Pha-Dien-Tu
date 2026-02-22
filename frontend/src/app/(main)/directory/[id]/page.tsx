'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Mail, Calendar, Shield, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export default function MemberDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [member, setMember] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchMember = useCallback(async () => {
        if (!params.id) return;
        setLoading(true);
        const { data } = await supabase.from('profiles').select('*').eq('id', params.id).single();
        if (data) setMember(data);
        setLoading(false);
    }, [params.id]);

    useEffect(() => { fetchMember(); }, [fetchMember]);

    if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!member) return <div className="text-center py-12 text-muted-foreground">Không tìm thấy thành viên</div>;

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <Button variant="ghost" size="sm" onClick={() => router.push('/directory')}>
                <ArrowLeft className="mr-2 h-4 w-4" />Quay lại
            </Button>
            <Card>
                <CardHeader className="text-center">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                        <User className="h-10 w-10 text-primary" />
                    </div>
                    <CardTitle>{(member.display_name as string) || (member.email as string)?.split('@')[0]}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4" />{member.email as string}</div>
                    <div className="flex items-center gap-2 text-sm"><Shield className="h-4 w-4" /><Badge variant="secondary">{(member.role as string)?.toUpperCase()}</Badge></div>
                    <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4" />Tham gia: {new Date(member.created_at as string).toLocaleDateString('vi-VN')}</div>
                </CardContent>
            </Card>
        </div>
    );
}
