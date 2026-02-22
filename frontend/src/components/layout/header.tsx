'use client';

import { Moon, Sun, LogOut, User, LogIn } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/notification-bell';
import { useAuth } from '@/components/auth-provider';

export function Header() {
    const { theme, setTheme } = useTheme();
    const { isLoggedIn, profile, isAdmin, signOut } = useAuth();
    const router = useRouter();

    const initials = profile?.display_name
        ? profile.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : profile?.email?.slice(0, 2).toUpperCase() || '?';

    const handleSignOut = async () => {
        await signOut();
        router.push('/login');
    };

    return (
        <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-card/80 backdrop-blur-sm px-4 lg:px-6">
            {/* Left side */}
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">
                    Dòng họ Lê Huy
                </h2>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
                {/* Theme toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-label="Toggle theme"
                >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>

                {/* Notifications */}
                <NotificationBell />

                {isLoggedIn ? (
                    /* User menu (logged in) */
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        {profile?.display_name || 'Thành viên'}
                                    </p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {profile?.email}
                                    </p>
                                    {isAdmin && (
                                        <span className="text-[10px] font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5 w-fit mt-1">
                                            Quản trị viên
                                        </span>
                                    )}
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <User className="mr-2 h-4 w-4" />
                                Hồ sơ cá nhân
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                                <LogOut className="mr-2 h-4 w-4" />
                                Đăng xuất
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    /* Login button (not logged in) */
                    <Button variant="outline" size="sm" onClick={() => router.push('/login')}>
                        <LogIn className="h-4 w-4 mr-2" /> Đăng nhập
                    </Button>
                )}
            </div>
        </header>
    );
}
