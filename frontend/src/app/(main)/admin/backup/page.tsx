'use client';

import { useEffect, useState, useCallback } from 'react';
import { Database, Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';

export default function BackupPage() {
    const { isAdmin } = useAuth();
    const [creating, setCreating] = useState(false);
    const [lastBackup, setLastBackup] = useState<string | null>(null);

    const createBackup = async () => {
        setCreating(true);
        try {
            // Export all data from Supabase
            const { data: people } = await supabase.from('people').select('*');
            const { data: families } = await supabase.from('families').select('*');
            const { data: profiles } = await supabase.from('profiles').select('*');

            const backup = {
                exported_at: new Date().toISOString(),
                people: people || [],
                families: families || [],
                profiles: profiles || [],
            };

            // Download as JSON
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `giapha-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setLastBackup(new Date().toISOString());
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Database className="h-6 w-6" />
                        Sao lưu & Khôi phục
                    </h1>
                    <p className="text-muted-foreground">Quản lý sao lưu cơ sở dữ liệu</p>
                </div>
                <Button onClick={createBackup} disabled={creating}>
                    <Download className="mr-2 h-4 w-4" />
                    {creating ? 'Đang xuất...' : 'Xuất backup JSON'}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Thông tin database</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <DatabaseStats />
                    {lastBackup && (
                        <p className="text-sm text-muted-foreground">
                            Backup gần nhất: {new Date(lastBackup).toLocaleString('vi-VN')}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function DatabaseStats() {
    const [stats, setStats] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const tables = ['people', 'families', 'profiles', 'posts', 'comments', 'events', 'notifications'];
            const counts: Record<string, number> = {};
            for (const t of tables) {
                const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
                counts[t] = count || 0;
            }
            setStats(counts);
            setLoading(false);
        }
        load();
    }, []);

    if (loading) return <div className="animate-pulse text-sm text-muted-foreground">Đang tải...</div>;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(stats).map(([table, count]) => (
                <div key={table} className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{table}</p>
                </div>
            ))}
        </div>
    );
}
