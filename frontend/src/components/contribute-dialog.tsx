'use client';

import { useState } from 'react';
import { X, Send, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';

const CONTRIBUTION_FIELDS = [
    { key: 'birth_year', label: 'Năm sinh', type: 'number', placeholder: 'VD: 1950' },
    { key: 'death_year', label: 'Năm mất', type: 'number', placeholder: 'VD: 2020' },
    { key: 'display_name', label: 'Họ tên', type: 'text', placeholder: 'VD: Lê Văn A' },
    { key: 'biography', label: 'Tiểu sử', type: 'textarea', placeholder: 'Thông tin tiểu sử...' },
    { key: 'occupation', label: 'Nghề nghiệp', type: 'text', placeholder: 'VD: Giáo viên' },
    { key: 'address', label: 'Địa chỉ', type: 'text', placeholder: 'VD: Hà Nội' },
    { key: 'phone', label: 'Số điện thoại', type: 'text', placeholder: 'VD: 0901234567' },
    { key: 'other', label: 'Thông tin khác', type: 'textarea', placeholder: 'Bổ sung thông tin...' },
];

interface ContributeDialogProps {
    personHandle: string;
    personName: string;
    onClose: () => void;
}

export function ContributeDialog({ personHandle, personName, onClose }: ContributeDialogProps) {
    const { user, profile, isLoggedIn } = useAuth();
    const [selectedField, setSelectedField] = useState(CONTRIBUTION_FIELDS[0].key);
    const [newValue, setNewValue] = useState('');
    const [note, setNote] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const fieldInfo = CONTRIBUTION_FIELDS.find(f => f.key === selectedField)!;

    const handleSubmit = async () => {
        if (!newValue.trim()) { setError('Vui lòng nhập thông tin'); return; }
        if (!isLoggedIn || !user) { setError('Bạn cần đăng nhập để đóng góp'); return; }

        setSending(true);
        setError('');

        const { error: insertError } = await supabase.from('contributions').insert({
            author_id: user.id,
            author_email: profile?.email || user.email || '',
            person_handle: personHandle,
            person_name: personName,
            field_name: selectedField,
            field_label: fieldInfo.label,
            old_value: null,
            new_value: newValue.trim(),
            note: note.trim() || null,
            status: 'pending',
        });

        setSending(false);

        if (insertError) {
            setError(insertError.message);
        } else {
            setSent(true);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[420px] max-w-[95vw] animate-in zoom-in-95 fade-in duration-200"
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b">
                    <div className="flex items-center gap-2">
                        <MessageSquarePlus className="w-5 h-5 text-blue-500" />
                        <div>
                            <h3 className="font-semibold text-sm">Đóng góp thông tin</h3>
                            <p className="text-xs text-muted-foreground">{personName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>

                {sent ? (
                    /* Success state */
                    <div className="p-8 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-green-100 mx-auto flex items-center justify-center">
                            <Send className="w-6 h-6 text-green-600" />
                        </div>
                        <h4 className="font-semibold text-green-700">Đã gửi đóng góp!</h4>
                        <p className="text-xs text-muted-foreground">Quản trị viên sẽ xem xét và phê duyệt.</p>
                        <Button variant="outline" size="sm" onClick={onClose}>Đóng</Button>
                    </div>
                ) : (
                    /* Form */
                    <div className="p-5 space-y-4">
                        {!isLoggedIn && (
                            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-400">
                                ⚠️ Bạn cần <a href="/login" className="underline font-medium">đăng nhập</a> để đóng góp thông tin.
                            </div>
                        )}

                        {error && (
                            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
                        )}

                        {/* Field selector */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Loại thông tin</label>
                            <select
                                value={selectedField}
                                onChange={e => setSelectedField(e.target.value)}
                                className="w-full rounded-lg border px-3 py-2 text-sm bg-background"
                            >
                                {CONTRIBUTION_FIELDS.map(f => (
                                    <option key={f.key} value={f.key}>{f.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Value input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">{fieldInfo.label}</label>
                            {fieldInfo.type === 'textarea' ? (
                                <textarea
                                    value={newValue}
                                    onChange={e => setNewValue(e.target.value)}
                                    placeholder={fieldInfo.placeholder}
                                    className="w-full rounded-lg border px-3 py-2 text-sm bg-background min-h-[80px] resize-y"
                                    rows={3}
                                />
                            ) : (
                                <Input
                                    type={fieldInfo.type}
                                    value={newValue}
                                    onChange={e => setNewValue(e.target.value)}
                                    placeholder={fieldInfo.placeholder}
                                />
                            )}
                        </div>

                        {/* Note */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Ghi chú (tuỳ chọn)</label>
                            <Input
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="VD: Theo lời kể của bác Hai..."
                            />
                        </div>

                        {/* Submit */}
                        <Button className="w-full" disabled={sending || !isLoggedIn} onClick={handleSubmit}>
                            {sending ? 'Đang gửi...' : <><Send className="w-4 h-4 mr-2" /> Gửi đóng góp</>}
                        </Button>

                        <p className="text-[10px] text-center text-muted-foreground">
                            Đóng góp sẽ được quản trị viên xem xét trước khi áp dụng.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
