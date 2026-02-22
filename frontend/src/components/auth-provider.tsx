'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'member' | null;

interface Profile {
    id: string;
    email: string;
    display_name: string | null;
    role: UserRole;
    person_handle: string | null;
    avatar_url: string | null;
}

interface AuthState {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    role: UserRole;
    loading: boolean;
    isAdmin: boolean;
    isMember: boolean;
    isLoggedIn: boolean;
    signIn: (email: string, password: string) => Promise<{ error?: string }>;
    signUp: (email: string, password: string, displayName?: string) => Promise<{ error?: string }>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = useCallback(async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            if (!error && data) {
                setProfile(data as Profile);
            } else {
                setProfile(null);
            }
        } catch {
            setProfile(null);
        }
    }, []);

    const ensureProfile = useCallback(async (u: User) => {
        // Create profile if it doesn't exist (handles signup)
        const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', u.id)
            .maybeSingle();

        if (!existing) {
            await supabase.from('profiles').insert({
                id: u.id,
                email: u.email || '',
                display_name: u.user_metadata?.display_name || u.email?.split('@')[0] || '',
                role: 'member',
            });
        }
        await fetchProfile(u.id);
    }, [fetchProfile]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            setSession(s);
            setUser(s?.user ?? null);
            if (s?.user) ensureProfile(s.user);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
            setSession(s);
            setUser(s?.user ?? null);
            if (s?.user) {
                ensureProfile(s.user);
            } else {
                setProfile(null);
            }
        });

        return () => subscription.unsubscribe();
    }, [ensureProfile]);

    const signIn = useCallback(async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                return { error: 'Email hoặc mật khẩu không đúng' };
            }
            return { error: error.message };
        }
        return {};
    }, []);

    const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: displayName || email.split('@')[0] },
            },
        });
        if (error) {
            if (error.message.includes('already registered')) {
                return { error: 'Email đã được đăng ký. Hãy đăng nhập.' };
            }
            return { error: error.message };
        }
        // If email confirmation is required
        if (data.user && !data.session) {
            return { error: 'Đã đăng ký! Kiểm tra email để xác nhận tài khoản.' };
        }
        return {};
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        setProfile(null);
    }, []);

    const refreshProfile = useCallback(async () => {
        if (user) await fetchProfile(user.id);
    }, [user, fetchProfile]);

    const role = profile?.role ?? null;

    return (
        <AuthContext.Provider value={{
            user, session, profile, role, loading,
            isAdmin: role === 'admin',
            isMember: role === 'member' || role === 'admin',
            isLoggedIn: !!user,
            signIn, signUp, signOut, refreshProfile,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
