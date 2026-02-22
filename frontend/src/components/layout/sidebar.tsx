'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home,
    TreePine,
    Users,
    Image,
    Shield,
    FileText,
    Database,
    ChevronLeft,
    ChevronRight,
    BookOpen,
    ClipboardCheck,
    Contact,
    Newspaper,
    CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';

const navItems = [
    { href: '/', label: 'Trang chủ', icon: Home },
    { href: '/feed', label: 'Bảng tin', icon: Newspaper },
    { href: '/directory', label: 'Danh bạ', icon: Contact },
    { href: '/events', label: 'Sự kiện', icon: CalendarDays },
    { href: '/tree', label: 'Cây gia phả', icon: TreePine },
    { href: '/book', label: 'Sách gia phả', icon: BookOpen },
    { href: '/people', label: 'Thành viên', icon: Users },
    { href: '/media', label: 'Thư viện', icon: Image },
];

const adminItems = [
    { href: '/admin/users', label: 'Quản lý Users', icon: Shield },
    { href: '/admin/edits', label: 'Kiểm duyệt', icon: ClipboardCheck },
    { href: '/admin/audit', label: 'Audit Log', icon: FileText },
    { href: '/admin/backup', label: 'Backup', icon: Database },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const { isAdmin } = useAuth();

    return (
        <aside
            className={cn(
                'flex flex-col border-r bg-card transition-all duration-300 h-screen sticky top-0',
                collapsed ? 'w-16' : 'w-64',
            )}
        >
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 py-4 border-b">
                <TreePine className="h-6 w-6 text-primary shrink-0" />
                {!collapsed && <span className="font-bold text-lg">Gia phả họ Lê</span>}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link key={item.href} href={item.href}>
                            <span
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                    isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                )}
                            >
                                <item.icon className="h-4 w-4 shrink-0" />
                                {!collapsed && item.label}
                            </span>
                        </Link>
                    );
                })}

                {/* Admin section — only visible for admin users */}
                {isAdmin && (
                    <>
                        {!collapsed && (
                            <div className="pt-4 pb-2">
                                <span className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                    Quản trị
                                </span>
                            </div>
                        )}
                        {collapsed && <div className="border-t my-2" />}
                        {adminItems.map((item) => {
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <Link key={item.href} href={item.href}>
                                    <span
                                        className={cn(
                                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                            isActive
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                        )}
                                    >
                                        <item.icon className="h-4 w-4 shrink-0" />
                                        {!collapsed && item.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </>
                )}
            </nav>

            {/* Contact info */}
            {!collapsed && (
                <div className="border-t px-4 py-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Để thiết lập <span className="font-semibold text-foreground">gia phả điện tử</span> riêng cho dòng họ, truy cập được từ bất kì đâu, vui lòng liên hệ
                        <br />
                        <span className="font-semibold text-foreground">📞 088 999 1120</span>
                        <br />
                        <span className="text-[10px] opacity-70">để nhận báo giá.</span>
                    </p>
                </div>
            )}

            {/* Collapse toggle */}
            <div className="border-t p-2">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    {!collapsed && <span className="ml-2">Thu gọn</span>}
                </Button>
            </div>
        </aside>
    );
}
