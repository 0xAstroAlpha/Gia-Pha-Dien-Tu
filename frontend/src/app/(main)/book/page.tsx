'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Printer, ArrowLeft, BookOpen, Eye, Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MOCK_TREE_NODES, MOCK_FAMILIES } from '@/lib/mock-genealogy';
import { generateBookData, type BookData, type BookPerson, type BookChapter } from '@/lib/book-generator';
import type { TreeNode, TreeFamily } from '@/lib/tree-layout';
import Link from 'next/link';

// ═══ Color Themes ═══
interface Theme {
    name: string; swatch: string;
    primary: string; primaryLight: string; primaryBg: string;
    secondary: string; accent: string;
    border: string; borderLight: string;
    text: string; textMuted: string;
}

const THEMES: Record<string, Theme> = {
    amber: {
        name: 'Cổ điển', swatch: '#92400e',
        primary: '#92400e', primaryLight: '#fef3c7', primaryBg: '#fffbeb',
        secondary: '#b45309', accent: '#d97706',
        border: '#fbbf24', borderLight: '#fde68a',
        text: '#451a03', textMuted: '#92400e99',
    },
    navy: {
        name: 'Thanh lịch', swatch: '#1e3a5f',
        primary: '#1e3a5f', primaryLight: '#dbeafe', primaryBg: '#eff6ff',
        secondary: '#2563eb', accent: '#3b82f6',
        border: '#60a5fa', borderLight: '#bfdbfe',
        text: '#0f172a', textMuted: '#1e3a5f99',
    },
    sage: {
        name: 'Thanh tao', swatch: '#365314',
        primary: '#365314', primaryLight: '#dcfce7', primaryBg: '#f0fdf4',
        secondary: '#15803d', accent: '#22c55e',
        border: '#4ade80', borderLight: '#bbf7d0',
        text: '#14532d', textMuted: '#36531499',
    },
    burgundy: {
        name: 'Trang trọng', swatch: '#7f1d1d',
        primary: '#7f1d1d', primaryLight: '#fce7f3', primaryBg: '#fff1f2',
        secondary: '#be123c', accent: '#e11d48',
        border: '#fb7185', borderLight: '#fecdd3',
        text: '#4c0519', textMuted: '#7f1d1d99',
    },
};

type ThemeKey = keyof typeof THEMES;

export default function BookPage() {
    const [bookData, setBookData] = useState<BookData | null>(null);
    const [loading, setLoading] = useState(true);
    const [previewMode, setPreviewMode] = useState(false);
    const [theme, setTheme] = useState<ThemeKey>('amber');
    const [showThemePanel, setShowThemePanel] = useState(false);
    const [previewScale, setPreviewScale] = useState(0.35);
    const gridRef = useRef<HTMLDivElement>(null);

    // Dynamic scale: fit 210mm (794px) content to actual card width
    useEffect(() => {
        if (!previewMode || !gridRef.current) return;
        const observer = new ResizeObserver(() => {
            const grid = gridRef.current;
            if (!grid) return;
            const firstCard = grid.querySelector('.preview-card-inner') as HTMLElement;
            if (firstCard) {
                setPreviewScale(firstCard.offsetWidth / 794);
            }
        });
        observer.observe(gridRef.current);
        return () => observer.disconnect();
    }, [previewMode]);

    const t = THEMES[theme];

    useEffect(() => {
        const fetchAndGenerate = async () => {
            let people: TreeNode[] = MOCK_TREE_NODES;
            let families: TreeFamily[] = MOCK_FAMILIES;
            try {
                const token = localStorage.getItem('accessToken');
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                if (token && apiUrl) {
                    const res = await fetch(`${apiUrl}/genealogy/tree`, {
                        headers: { Authorization: `Bearer ${token}` },
                        signal: AbortSignal.timeout(3000),
                    });
                    if (res.ok) {
                        const json = await res.json();
                        people = json.data.people;
                        families = json.data.families;
                    }
                }
            } catch { /* fallback to mock */ }
            const data = generateBookData(people, families, 'Lê Huy');
            setBookData(data);
            setLoading(false);
        };
        fetchAndGenerate();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-pulse text-muted-foreground flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    <span>Đang tạo sách gia phả...</span>
                </div>
            </div>
        );
    }
    if (!bookData) return null;

    // Paginate chapters: 2-col layout, optimized for A4 (297mm) pages
    const FIRST_PAGE_LIMIT = 10;  // first page has header, fits ~10 members
    const CONT_PAGE_LIMIT = 14;   // continuation pages fit ~14 members
    const APPENDIX_PAGE_LIMIT = 50; // ~50 name entries per appendix page (2-col)

    interface Section {
        id: string;
        label: string;
        pageNum: number;
        chapterGen?: number;
        memberStart?: number;
        memberEnd?: number;
        isFirstPage?: boolean;
        // For appendix pagination:
        appendixStart?: number;
        appendixEnd?: number;
        appendixIsFirst?: boolean;
    }

    const sections: Section[] = [
        { id: 'cover', label: 'Bìa', pageNum: 1 },
        { id: 'toc', label: 'Mục lục', pageNum: 2 },
    ];

    let pageCounter = 3;
    for (const ch of bookData.chapters) {
        const total = ch.members.length;
        if (total <= FIRST_PAGE_LIMIT) {
            sections.push({
                id: `gen-${ch.generation}`,
                label: `Đời ${ch.romanNumeral}`,
                pageNum: pageCounter++,
                chapterGen: ch.generation,
                memberStart: 0,
                memberEnd: total,
                isFirstPage: true,
            });
        } else {
            let start = 0;
            let pageIdx = 0;
            while (start < total) {
                const limit = pageIdx === 0 ? FIRST_PAGE_LIMIT : CONT_PAGE_LIMIT;
                const end = Math.min(start + limit, total);
                sections.push({
                    id: `gen-${ch.generation}-p${pageIdx}`,
                    label: pageIdx === 0 ? `Đời ${ch.romanNumeral}` : `Đời ${ch.romanNumeral} (tt)`,
                    pageNum: pageCounter++,
                    chapterGen: ch.generation,
                    memberStart: start,
                    memberEnd: end,
                    isFirstPage: pageIdx === 0,
                });
                start = end;
                pageIdx++;
            }
        }
    }

    // Paginate appendix: split all name entries across multiple pages
    const allNames = bookData.nameIndex;
    const totalNames = allNames.length;
    if (totalNames <= APPENDIX_PAGE_LIMIT) {
        sections.push({ id: 'appendix', label: 'Phụ lục', pageNum: pageCounter++, appendixStart: 0, appendixEnd: totalNames, appendixIsFirst: true });
    } else {
        let aStart = 0;
        let aPage = 0;
        while (aStart < totalNames) {
            // First appendix page has header, so fewer entries
            const limit = aPage === 0 ? APPENDIX_PAGE_LIMIT - 10 : APPENDIX_PAGE_LIMIT;
            const aEnd = Math.min(aStart + limit, totalNames);
            sections.push({
                id: aPage === 0 ? 'appendix' : `appendix-p${aPage}`,
                label: aPage === 0 ? 'Phụ lục' : `Phụ lục (tt${aPage + 1})`,
                pageNum: pageCounter++,
                appendixStart: aStart,
                appendixEnd: aEnd,
                appendixIsFirst: aPage === 0,
            });
            aStart = aEnd;
            aPage++;
        }
    }

    sections.push({ id: 'closing', label: 'Kết sách', pageNum: pageCounter++ });

    return (
        <div className="min-w-0 w-full overflow-hidden">
            {/* ═══ TOOLBAR ═══ */}
            <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b shadow-sm">
                <div className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Link href="/tree">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="w-4 h-4 mr-1" /> Cây gia phả
                            </Button>
                        </Link>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                            {bookData.totalMembers} thành viên · {bookData.totalGenerations} đời · {sections.length} trang
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {/* Theme picker */}
                        <div className="relative">
                            <Button variant="outline" size="sm" className="gap-1.5"
                                onClick={() => setShowThemePanel(!showThemePanel)}>
                                <Palette className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline text-xs">{t.name}</span>
                                <span className="w-3 h-3 rounded-full border" style={{ background: t.swatch }} />
                            </Button>
                            {showThemePanel && (
                                <div className="absolute right-0 top-full mt-1 bg-white border rounded-xl shadow-xl p-3 min-w-[200px] z-50">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Bảng màu</p>
                                    <div className="space-y-1">
                                        {Object.entries(THEMES).map(([key, th]) => (
                                            <button key={key}
                                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm
                                                    ${theme === key ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'}`}
                                                onClick={() => { setTheme(key); setShowThemePanel(false); }}>
                                                <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                                                    style={{ background: th.primaryLight, borderColor: th.primary }}>
                                                    {theme === key && <Check className="w-3 h-3" style={{ color: th.primary }} />}
                                                </span>
                                                <span>{th.name}</span>
                                                <div className="flex gap-0.5 ml-auto">
                                                    <span className="w-3 h-3 rounded-full" style={{ background: th.primary }} />
                                                    <span className="w-3 h-3 rounded-full" style={{ background: th.secondary }} />
                                                    <span className="w-3 h-3 rounded-full" style={{ background: th.accent }} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Preview toggle */}
                        <Button variant={previewMode ? 'default' : 'outline'} size="sm" className="gap-1.5"
                            onClick={() => setPreviewMode(!previewMode)}>
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-xs">Xem trước</span>
                        </Button>

                        {/* Print */}
                        <Button onClick={() => window.print()} size="sm" className="gap-1.5">
                            <Printer className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-xs">In sách</span>
                        </Button>
                    </div>
                </div>

                {/* Preview quick-nav strip */}
                {previewMode && (
                    <div className="border-t bg-slate-50 px-4 py-2 overflow-hidden">
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin" style={{ maxWidth: '100%' }}>
                            {sections.map(s => (
                                <a key={s.id} href={`#preview-${s.id}`}
                                    className="flex-shrink-0 px-2 py-1 rounded-md text-[11px] font-medium
                                        bg-white border hover:shadow-sm transition-all whitespace-nowrap"
                                    style={{ borderColor: t.borderLight, color: t.primary }}>
                                    {s.label}
                                    <span className="ml-0.5 text-[9px] opacity-50">·{s.pageNum}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ PRINT PREVIEW GALLERY ═══ */}
            {previewMode && (
                <div className="no-print bg-slate-100 min-h-screen p-6">
                    <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                        {sections.map(s => (
                            <div key={s.id} id={`preview-${s.id}`} className="relative">
                                <div className="preview-card-inner bg-white rounded-lg shadow-md border overflow-hidden hover:shadow-xl transition-shadow">
                                    <div className="absolute top-2 right-2 z-10 bg-white/90 border rounded-full px-2 py-0.5 text-[10px] font-mono"
                                        style={{ color: t.primary }}>
                                        Trang {s.pageNum}
                                    </div>
                                    <div className="aspect-[210/297] overflow-hidden">
                                        <div
                                            className="w-[210mm] h-[297mm] origin-top-left"
                                            style={{ transform: `scale(${previewScale})` }}
                                        >
                                            <BookSection sectionId={s.id} bookData={bookData} theme={t}
                                                memberStart={s.memberStart} memberEnd={s.memberEnd} isFirstPage={s.isFirstPage}
                                                appendixStart={s.appendixStart} appendixEnd={s.appendixEnd} appendixIsFirst={s.appendixIsFirst} />
                                        </div>
                                    </div>
                                    <div className="px-3 py-2 border-t text-xs font-medium" style={{ color: t.primary }}>
                                        {s.label}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ NORMAL READING MODE ═══ */}
            {!previewMode && (
                <div className="book-content max-w-[210mm] mx-auto bg-white"
                    style={{ fontFamily: "'Noto Serif', Georgia, serif", color: t.text }}>

                    <CoverPage bookData={bookData} theme={t} />

                    <section id="toc" className="page-break px-8 py-12">
                        <span className="page-label">Trang 2</span>
                        <TocContent bookData={bookData} theme={t} />
                    </section>

                    {bookData.chapters.map((ch, ci) => (
                        <section key={ch.generation} id={`gen-${ch.generation}`} className="page-break px-8 py-12">
                            <span className="page-label">Trang {ci + 3}</span>
                            <ChapterContent chapter={ch} theme={t} />
                        </section>
                    ))}

                    <section id="appendix" className="page-break px-8 py-12">
                        <span className="page-label">Trang {bookData.chapters.length + 3}</span>
                        <AppendixContent bookData={bookData} theme={t} />
                    </section>

                    <section id="closing" className="page-break px-8 py-16 text-center" style={{ fontFamily: "'Noto Serif', Georgia, serif" }}>
                        <span className="page-label">Trang {bookData.chapters.length + 4}</span>
                        <ClosingContent bookData={bookData} theme={t} />
                    </section>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap');

                .book-content { font-family: 'Noto Serif', 'Georgia', serif; }

                @media print {
                    body { margin: 0; padding: 0; }
                    .no-print { display: none !important; }
                    .book-content { max-width: none; }
                    @page {
                        size: A4;
                        margin: 20mm 18mm 25mm 18mm;
                    }
                    .cover-page { min-height: auto; padding: 40mm 15mm; }
                    .page-break { page-break-before: always; }
                    .person-entry { page-break-inside: avoid; }
                    .chapter-header { page-break-after: avoid; }
                    h2, h3 { page-break-after: avoid; }
                    .page-label { display: none; }
                }

                @media screen {
                    .page-break { border-top: 2px dashed ${t.borderLight}; position: relative; }
                    .page-label {
                        position: absolute; top: -10px; left: 50%;
                        transform: translateX(-50%);
                        background: white; padding: 0 12px;
                        font-size: 11px; color: ${t.primary};
                        font-family: 'Noto Serif', serif;
                    }
                }
            ` }} />
        </div>
    );
}

// ═══ BookSection — renders a single section for preview gallery ═══
function BookSection({ sectionId, bookData, theme: t, memberStart, memberEnd, isFirstPage, appendixStart, appendixEnd, appendixIsFirst }: {
    sectionId: string; bookData: BookData; theme: Theme;
    memberStart?: number; memberEnd?: number; isFirstPage?: boolean;
    appendixStart?: number; appendixEnd?: number; appendixIsFirst?: boolean;
}) {
    return (
        <div className="book-content px-12 py-12" style={{ fontFamily: "'Noto Serif', Georgia, serif", color: t.text }}>
            {sectionId === 'cover' && <CoverPage bookData={bookData} theme={t} />}
            {sectionId === 'toc' && <TocContent bookData={bookData} theme={t} />}
            {(sectionId === 'appendix' || sectionId.startsWith('appendix-')) && (
                <AppendixContent bookData={bookData} theme={t}
                    startIdx={appendixStart ?? 0} endIdx={appendixEnd ?? bookData.nameIndex.length}
                    showHeader={appendixIsFirst !== false} />
            )}
            {sectionId === 'closing' && <ClosingContent bookData={bookData} theme={t} />}
            {sectionId.startsWith('gen-') && (() => {
                const genStr = sectionId.replace('gen-', '').split('-')[0];
                const gen = parseInt(genStr);
                const ch = bookData.chapters.find(c => c.generation === gen);
                if (!ch) return null;
                const start = memberStart ?? 0;
                const end = memberEnd ?? ch.members.length;
                const members = ch.members.slice(start, end);
                return <ChapterContent chapter={ch} theme={t} members={members} startIndex={start} showHeader={isFirstPage !== false} />;
            })()}
        </div>
    );
}

// ═══ Section Components ═══

function CoverPage({ bookData, theme: t }: { bookData: BookData; theme: Theme }) {
    return (
        <section className="cover-page flex flex-col items-center justify-center text-center px-8 py-16 min-h-[280mm]">
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-24 h-0.5 mb-8" style={{ background: t.primary }} />
                <h1 className="text-4xl font-bold tracking-wider font-serif mb-2" style={{ color: t.primary }}>
                    GIA PHẢ
                </h1>
                <h2 className="text-5xl font-bold tracking-widest font-serif mb-8" style={{ color: t.secondary }}>
                    DÒNG HỌ {bookData.familyName.toUpperCase()}
                </h2>
                <div className="w-32 h-0.5 mb-10" style={{ background: t.primary }} />
                <div className="space-y-2 text-lg font-serif" style={{ color: t.textMuted }}>
                    <p>{bookData.totalGenerations} đời · {bookData.totalMembers} thành viên</p>
                    <p className="text-base">{bookData.totalPatrilineal} người chính tộc</p>
                </div>
            </div>
            <div className="text-sm font-serif" style={{ color: t.textMuted }}>
                <p>Xuất bản ngày {bookData.exportDate}</p>
                <p className="mt-1">Gia phả dòng họ Lê Huy</p>
            </div>
        </section>
    );
}

function TocContent({ bookData, theme: t }: { bookData: BookData; theme: Theme }) {
    return (
        <>
            <h2 className="text-2xl font-bold text-center font-serif mb-8 tracking-wide" style={{ color: t.primary }}>
                MỤC LỤC
            </h2>
            <div className="w-16 h-0.5 mx-auto mb-10" style={{ background: t.primary }} />
            <div className="space-y-4 max-w-md mx-auto">
                {bookData.chapters.map(ch => (
                    <a key={ch.generation} href={`#gen-${ch.generation}`}
                        className="flex items-baseline gap-2 group transition-colors">
                        <span className="font-serif font-semibold" style={{ color: t.primary }}>
                            {ch.title}
                        </span>
                        <span className="flex-1 border-b border-dotted mx-2" style={{ borderColor: t.borderLight }} />
                        <span className="text-sm font-mono" style={{ color: t.textMuted }}>
                            {ch.members.length} người
                        </span>
                    </a>
                ))}
                <div className="pt-4" style={{ borderTop: `1px solid ${t.borderLight}` }}>
                    <a href="#appendix" className="flex items-baseline gap-2 group">
                        <span className="font-serif font-semibold" style={{ color: t.primary }}>PHỤ LỤC — Chỉ mục tên</span>
                        <span className="flex-1 border-b border-dotted mx-2" style={{ borderColor: t.borderLight }} />
                        <span className="text-sm font-mono" style={{ color: t.textMuted }}>{bookData.nameIndex.length} tên</span>
                    </a>
                </div>
            </div>
        </>
    );
}

function ChapterContent({ chapter, theme: t, members, startIndex, showHeader }: {
    chapter: BookChapter; theme: Theme;
    members?: BookPerson[]; startIndex?: number; showHeader?: boolean;
}) {
    const displayMembers = members ?? chapter.members;
    const offset = startIndex ?? 0;
    return (
        <>
            {showHeader !== false && (
                <div className="chapter-header text-center mb-10">
                    <div className="w-full h-px mb-6" style={{ background: `${t.primary}33` }} />
                    <h2 className="text-2xl font-bold font-serif tracking-widest" style={{ color: t.primary }}>
                        {chapter.title}
                    </h2>
                    <p className="text-sm mt-2 font-serif" style={{ color: t.textMuted }}>
                        {chapter.members.length} thành viên chính tộc
                    </p>
                    <div className="w-full h-px mt-6" style={{ background: `${t.primary}33` }} />
                </div>
            )}
            {showHeader === false && (
                <p className="text-xs mb-6 font-serif italic" style={{ color: t.textMuted }}>
                    {chapter.title} (tiếp theo)
                </p>
            )}
            <div className="grid grid-cols-2 gap-4">
                {displayMembers.map((person, idx) => (
                    <PersonEntry key={person.handle} person={person} index={offset + idx + 1} theme={t} />
                ))}
            </div>
        </>
    );
}

function PersonEntry({ person, index, theme: t }: { person: BookPerson; index: number; theme: Theme }) {
    const years = person.birthYear
        ? `${person.birthYear}${person.deathYear ? ` – ${person.deathYear}` : person.isLiving ? ' – nay' : ''}`
        : '—';
    const isMale = person.gender === 1;

    return (
        <div className="person-entry rounded-lg p-4" style={{ border: `1px solid ${t.borderLight}`, background: t.primaryBg }}>
            <div className="flex items-start gap-2.5 mb-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center font-bold mt-0.5"
                    style={{ background: t.primary }}>{index}</span>
                <div>
                    <h3 className="text-base font-bold tracking-wide leading-tight" style={{ color: t.primary }}>{person.name}</h3>
                    <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>
                        {years}
                        {!person.isLiving && person.deathYear && ' · Đã mất'}
                        {person.isLiving && ' · Còn sống'}
                    </p>
                </div>
            </div>
            <div className="ml-8 space-y-1 text-xs">
                {person.fatherName && (
                    <div className="flex gap-1.5">
                        <span className="w-12 flex-shrink-0" style={{ color: t.textMuted }}>Cha:</span>
                        <span style={{ color: t.text }}>{person.fatherName}</span>
                    </div>
                )}
                {person.motherName && (
                    <div className="flex gap-1.5">
                        <span className="w-12 flex-shrink-0" style={{ color: t.textMuted }}>Mẹ:</span>
                        <span style={{ color: t.text }}>{person.motherName}</span>
                    </div>
                )}
                {person.spouseName && (
                    <div className="flex gap-1.5">
                        <span className="w-12 flex-shrink-0" style={{ color: t.textMuted }}>{isMale ? 'Vợ:' : 'Chồng:'}</span>
                        <span style={{ color: t.text }}>
                            {person.spouseName}
                            {person.spouseYears && <span style={{ color: t.textMuted }}> ({person.spouseYears})</span>}
                        </span>
                    </div>
                )}
                {person.children.length > 0 && (
                    <div className="pt-1.5 mt-1.5" style={{ borderTop: `1px solid ${t.borderLight}` }}>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: t.textMuted }}>
                            Con ({person.children.length})
                        </span>
                        <ol className="mt-0.5 ml-3 space-y-0">
                            {person.children.map((child, i) => (
                                <li key={i} className="list-decimal" style={{ color: t.text }}>
                                    <span className={child.note ? 'text-stone-500' : 'font-medium'}>{child.name}</span>
                                    <span style={{ color: t.textMuted }}> ({child.years})</span>
                                    {child.note && <span className="text-stone-400 text-[10px] ml-0.5">· {child.note}</span>}
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </div>
        </div>
    );
}

function AppendixContent({ bookData, theme: t, startIdx, endIdx, showHeader }: {
    bookData: BookData; theme: Theme;
    startIdx?: number; endIdx?: number; showHeader?: boolean;
}) {
    const patrilineal = bookData.nameIndex.filter(e => e.isPatrilineal);
    const ngoaitoc = bookData.nameIndex.filter(e => !e.isPatrilineal);
    // Combined sorted list for pagination
    const allEntries = [...patrilineal, ...ngoaitoc];
    const start = startIdx ?? 0;
    const end = endIdx ?? allEntries.length;
    const pageEntries = allEntries.slice(start, end);

    // Determine section boundaries
    const patriEnd = patrilineal.length;
    const showPatriHeader = start < patriEnd;
    const showNgoaiHeader = end > patriEnd && start < allEntries.length;

    return (
        <>
            {showHeader !== false && (
                <>
                    <h2 className="text-2xl font-bold text-center font-serif mb-2 tracking-wide" style={{ color: t.primary }}>
                        PHỤ LỤC
                    </h2>
                    <p className="text-center font-serif mb-6" style={{ color: t.textMuted }}>Chỉ mục tên theo thứ tự A-Z</p>
                    <div className="w-16 h-0.5 mx-auto mb-8" style={{ background: t.primary }} />
                </>
            )}
            {showHeader === false && (
                <p className="text-xs mb-6 font-serif italic" style={{ color: t.textMuted }}>
                    Phụ lục (tiếp theo)
                </p>
            )}

            {/* Render entries with section headers inline */}
            {showPatriHeader && start === 0 && (
                <h3 className="text-base font-bold font-serif mb-3 tracking-wide pb-2"
                    style={{ color: t.primary, borderBottom: `1px solid ${t.border}` }}>
                    NỘI TỘC — Dòng họ {bookData.familyName} ({patrilineal.length} người)
                </h3>
            )}

            <div className="columns-2 gap-6 text-sm font-serif">
                {pageEntries.map((entry, i) => {
                    const globalIdx = start + i;
                    const isNgoaiStart = globalIdx === patriEnd;
                    return (
                        <div key={`e-${globalIdx}`}>
                            {isNgoaiStart && (
                                <h3 className="text-base font-bold font-serif mb-3 mt-6 tracking-wide pb-2 text-stone-600 border-b border-stone-300 break-before-column">
                                    NGOẠI TỘC — Thân thuộc ({ngoaitoc.length} người)
                                </h3>
                            )}
                            <div className="flex items-baseline gap-1 py-0.5 break-inside-avoid">
                                <span className={globalIdx < patriEnd ? 'font-semibold' : 'text-stone-600'}
                                    style={globalIdx < patriEnd ? { color: t.primary } : undefined}>
                                    {entry.name}
                                </span>
                                <span className="flex-1 border-b border-dotted mx-1"
                                    style={{ borderColor: globalIdx < patriEnd ? t.borderLight : '#d6d3d1' }} />
                                <span className="text-xs"
                                    style={{ color: globalIdx < patriEnd ? t.textMuted : '#a8a29e' }}>
                                    Đời {entry.generation + 1}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

function ClosingContent({ bookData, theme: t }: { bookData: BookData; theme: Theme }) {
    return (
        <>
            <div className="w-16 h-0.5 mx-auto mb-8" style={{ background: t.primary }} />
            <p className="text-lg italic" style={{ color: t.secondary }}>
                &ldquo;Cây có gốc mới nở cành xanh lá,<br />
                Nước có nguồn mới bể rộng sông sâu.&rdquo;
            </p>
            <div className="w-16 h-0.5 mx-auto mt-8 mb-6" style={{ background: t.primary }} />
            <p className="text-sm" style={{ color: t.textMuted }}>
                Gia phả dòng họ {bookData.familyName}<br />
                {bookData.exportDate}
            </p>
        </>
    );
}
