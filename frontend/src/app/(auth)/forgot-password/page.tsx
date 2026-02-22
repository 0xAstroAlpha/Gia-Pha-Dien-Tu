'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TreePine, ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

const forgotSchema = z.object({
    email: z.string().email('Email không hợp lệ'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

    const onSubmit = async (data: ForgotForm) => {
        try {
            setError('');
            setLoading(true);
            const { error: resetErr } = await supabase.auth.resetPasswordForEmail(data.email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (resetErr) {
                setError(resetErr.message);
            } else {
                setSent(true);
            }
        } catch {
            setError('Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-0 shadow-2xl">
            <CardHeader className="text-center space-y-2">
                <div className="flex justify-center">
                    <div className="rounded-full bg-primary/10 p-3">
                        <TreePine className="h-8 w-8 text-primary" />
                    </div>
                </div>
                <CardTitle className="text-2xl font-bold">Quên mật khẩu</CardTitle>
                <CardDescription>Nhập email để nhận link đặt lại mật khẩu</CardDescription>
            </CardHeader>
            <CardContent>
                {sent ? (
                    <div className="space-y-4 text-center">
                        <div className="rounded-md bg-green-500/10 p-4 text-sm text-green-600 dark:text-green-400">
                            ✅ Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link đặt lại mật khẩu.
                        </div>
                        <Link href="/login">
                            <Button variant="outline" className="w-full">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Quay lại đăng nhập
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {error && (
                            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="email">Email</label>
                            <Input id="email" type="email" placeholder="email@example.com" {...register('email')} />
                            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Đang gửi...' : 'Gửi link đặt lại'}
                        </Button>

                        <div className="text-center">
                            <Link href="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                <ArrowLeft className="inline h-3 w-3 mr-1" />
                                Quay lại đăng nhập
                            </Link>
                        </div>
                    </form>
                )}
            </CardContent>
        </Card>
    );
}
