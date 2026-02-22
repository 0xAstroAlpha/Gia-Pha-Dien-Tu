'use client';

import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { ContributeDialog } from '@/components/contribute-dialog';
import { Search, ZoomIn, ZoomOut, Maximize2, TreePine, Eye, Users, GitBranch, User, ArrowDownToLine, ArrowUpFromLine, Crosshair, X, ChevronDown, ChevronRight, BarChart3, Package, Link, ChevronsDownUp, ChevronsUpDown, Copy, Pencil, Save, RotateCcw, Trash2, ArrowUp, ArrowDown, GripVertical, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

import {
    fetchTreeData,
    updateFamilyChildren as supaUpdateFamilyChildren,
    moveChildToFamily as supaMoveChild,
    removeChildFromFamily as supaRemoveChild,
    updatePersonLiving as supaUpdatePersonLiving,
    updatePerson as supaUpdatePerson,
} from '@/lib/supabase-data';
import {
    computeLayout, filterAncestors, filterDescendants,
    CARD_W, CARD_H,
    type TreeNode, type TreeFamily, type LayoutResult, type PositionedNode, type PositionedCouple, type Connection,
} from '@/lib/tree-layout';

type ViewMode = 'full' | 'ancestor' | 'descendant';
type ZoomLevel = 'full' | 'compact' | 'mini';

function getZoomLevel(scale: number): ZoomLevel {
    if (scale > 0.6) return 'full';
    if (scale > 0.3) return 'compact';
    return 'mini';
}

// === Branch Summary (F4) ===
interface BranchSummary {
    parentHandle: string;
    totalDescendants: number;
    generationRange: [number, number];
    livingCount: number;
    deceasedCount: number;
    patrilinealCount: number;
}

function computeBranchSummary(
    handle: string,
    people: TreeNode[],
    families: TreeFamily[],
): BranchSummary {
    const personMap = new Map(people.map(p => [p.handle, p]));
    const familyMap = new Map(families.map(f => [f.handle, f]));
    const visited = new Set<string>();
    let livingCount = 0, deceasedCount = 0, patrilinealCount = 0;
    let minGen = Infinity, maxGen = -Infinity;

    function walk(h: string, gen: number) {
        if (visited.has(h)) return;
        visited.add(h);
        const person = personMap.get(h);
        if (!person) return;
        if (gen < minGen) minGen = gen;
        if (gen > maxGen) maxGen = gen;
        if (person.isLiving) livingCount++; else deceasedCount++;
        if (person.isPatrilineal) patrilinealCount++;
        for (const fId of person.families) {
            const fam = familyMap.get(fId);
            if (!fam) continue;
            for (const ch of fam.children) walk(ch, gen + 1);
        }
    }

    // Walk from this person's children (not including the person itself)
    const person = personMap.get(handle);
    if (person) {
        for (const fId of person.families) {
            const fam = familyMap.get(fId);
            if (!fam) continue;
            // Also count spouse
            if (fam.motherHandle && fam.motherHandle !== handle && !visited.has(fam.motherHandle)) {
                const spouse = personMap.get(fam.motherHandle);
                if (spouse) { visited.add(fam.motherHandle); if (spouse.isLiving) livingCount++; else deceasedCount++; }
            }
            if (fam.fatherHandle && fam.fatherHandle !== handle && !visited.has(fam.fatherHandle)) {
                const spouse = personMap.get(fam.fatherHandle);
                if (spouse) { visited.add(fam.fatherHandle); if (spouse.isLiving) livingCount++; else deceasedCount++; }
            }
            for (const ch of fam.children) walk(ch, 1);
        }
    }

    return {
        parentHandle: handle,
        totalDescendants: visited.size,
        generationRange: [minGen === Infinity ? 0 : minGen, maxGen === -Infinity ? 0 : maxGen],
        livingCount, deceasedCount, patrilinealCount,
    };
}

// === Tree Stats (F3) ===
interface TreeStats {
    total: number;
    totalFamilies: number;
    totalGenerations: number;
    perGeneration: { gen: number; count: number }[];
    livingCount: number;
    deceasedCount: number;
    patrilinealCount: number;
    nonPatrilinealCount: number;
}

function computeTreeStats(nodes: PositionedNode[], families: TreeFamily[]): TreeStats {
    const genMap = new Map<number, number>();
    let living = 0, deceased = 0, patri = 0, nonPatri = 0;
    for (const n of nodes) {
        const gen = n.generation + 1;
        genMap.set(gen, (genMap.get(gen) ?? 0) + 1);
        if (n.node.isLiving) living++; else deceased++;
        if (n.node.isPatrilineal) patri++; else nonPatri++;
    }
    const perGeneration = Array.from(genMap.entries())
        .map(([gen, count]) => ({ gen, count }))
        .sort((a, b) => a.gen - b.gen);
    return {
        total: nodes.length,
        totalFamilies: families.length,
        totalGenerations: perGeneration.length,
        perGeneration,
        livingCount: living,
        deceasedCount: deceased,
        patrilinealCount: patri,
        nonPatrilinealCount: nonPatri,
    };
}

// Default depth at which branches auto-collapse in panoramic view (0-indexed: gen 3 = Đời 4)
const AUTO_COLLAPSE_GEN = 8;

// Compute generations via BFS from root persons (persons not in any family as children)
function computePersonGenerations(people: TreeNode[], families: TreeFamily[]): Map<string, number> {
    const childOf = new Set<string>();
    for (const f of families) for (const ch of f.children) childOf.add(ch);
    const roots = people.filter(p => p.isPatrilineal && !childOf.has(p.handle));
    const gens = new Map<string, number>();
    const familyMap = new Map(families.map(f => [f.handle, f]));
    const queue: { handle: string; gen: number }[] = roots.map(r => ({ handle: r.handle, gen: 0 }));
    while (queue.length > 0) {
        const { handle, gen } = queue.shift()!;
        if (gens.has(handle)) continue;
        gens.set(handle, gen);
        const person = people.find(p => p.handle === handle);
        if (!person) continue;
        for (const fId of person.families) {
            const fam = familyMap.get(fId);
            if (!fam) continue;
            // Spouse at same gen
            if (fam.fatherHandle && !gens.has(fam.fatherHandle)) gens.set(fam.fatherHandle, gen);
            if (fam.motherHandle && !gens.has(fam.motherHandle)) gens.set(fam.motherHandle, gen);
            for (const ch of fam.children) {
                if (!gens.has(ch)) queue.push({ handle: ch, gen: gen + 1 });
            }
        }
    }
    return gens;
}

export default function TreeViewPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const containerRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    const [treeData, setTreeData] = useState<{ people: TreeNode[]; families: TreeFamily[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('full');
    const [focusPerson, setFocusPerson] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [highlightHandles, setHighlightHandles] = useState<Set<string>>(new Set());
    const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ handle: string; x: number; y: number } | null>(null);
    const [contributePerson, setContributePerson] = useState<{ handle: string; name: string } | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);

    // F4: Collapsible branches
    const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());
    // F3: Stats panel user-hidden
    const [statsHidden, setStatsHidden] = useState(false);

    // Editor mode state
    const [editorMode, setEditorMode] = useState(false);
    const [selectedCard, setSelectedCard] = useState<string | null>(null);
    const { isAdmin } = useAuth();

    // URL query param initialization + auto-collapse on initial load
    const urlInitialized = useRef(false);
    useEffect(() => {
        if (urlInitialized.current || !treeData) return;
        urlInitialized.current = true;
        const viewParam = searchParams.get('view') as ViewMode | null;
        const personParam = searchParams.get('person');
        if (viewParam && ['full', 'ancestor', 'descendant'].includes(viewParam)) {
            setViewMode(viewParam);
        }
        if (personParam && treeData.people.some(p => p.handle === personParam)) {
            setFocusPerson(personParam);
        }
        // Auto-collapse on initial load
        if (!viewParam || viewParam === 'full') {
            // Panoramic: collapse by absolute generation
            const gens = computePersonGenerations(treeData.people, treeData.families);
            const toCollapse = new Set<string>();
            for (const f of treeData.families) {
                if (f.children.length === 0) continue;
                const parentHandle = f.fatherHandle || f.motherHandle;
                if (!parentHandle) continue;
                const gen = gens.get(parentHandle);
                if (gen !== undefined && gen >= AUTO_COLLAPSE_GEN) {
                    toCollapse.add(parentHandle);
                }
            }
            setCollapsedBranches(toCollapse);
        } else if (viewParam === 'descendant' && personParam) {
            // Descendant: collapse by relative depth from focus person
            const personMap = new Map(treeData.people.map(p => [p.handle, p]));
            const toCollapse = new Set<string>();
            const depthMap = new Map<string, number>();
            const queue: string[] = [personParam];
            depthMap.set(personParam, 0);
            while (queue.length > 0) {
                const h = queue.shift()!;
                const depth = depthMap.get(h)!;
                const p = personMap.get(h);
                if (!p) continue;
                for (const fId of p.families) {
                    const fam = treeData.families.find(f => f.handle === fId);
                    if (!fam || fam.children.length === 0) continue;
                    if (depth >= AUTO_COLLAPSE_GEN) {
                        toCollapse.add(h);
                    } else {
                        for (const ch of fam.children) {
                            if (!depthMap.has(ch)) {
                                depthMap.set(ch, depth + 1);
                                queue.push(ch);
                            }
                        }
                    }
                }
            }
            setCollapsedBranches(toCollapse);
        }
    }, [searchParams, treeData]);

    // Sync URL when view/focus changes
    useEffect(() => {
        if (!urlInitialized.current) return;
        const params = new URLSearchParams();
        if (viewMode !== 'full') params.set('view', viewMode);
        if (focusPerson && viewMode !== 'full') params.set('person', focusPerson);
        const qs = params.toString();
        router.replace(`/tree${qs ? '?' + qs : ''}`, { scroll: false });
    }, [viewMode, focusPerson, router]);

    // Transform state
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef({ startX: 0, startY: 0, startTx: 0, startTy: 0 });
    const pinchRef = useRef({ initialDist: 0, initialScale: 1 });

    // Fetch data
    useEffect(() => {
        const fetchTree = async () => {
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
                        setTreeData(json.data);
                        setLoading(false);
                        return;
                    }
                }
            } catch { /* fallback */ }
            // Load from Supabase
            try {
                const data = await fetchTreeData();
                if (data.people.length > 0) {
                    setTreeData(data);
                    setLoading(false);
                    return;
                }
            } catch { /* fallback to mock */ }
            setTreeData(null);
            setLoading(false);
        };
        fetchTree();
    }, []);

    // Filtered data for view mode
    const displayData = useMemo(() => {
        if (!treeData) return null;
        if (viewMode === 'full' || !focusPerson) return treeData;
        if (viewMode === 'ancestor') return filterAncestors(focusPerson, treeData.people, treeData.families);
        if (viewMode === 'descendant') return filterDescendants(focusPerson, treeData.people, treeData.families);
        return treeData;
    }, [treeData, viewMode, focusPerson]);

    // F1: Zoom level
    const zoomLevel = useMemo<ZoomLevel>(() => getZoomLevel(transform.scale), [transform.scale]);

    // F4: Get all descendants of collapsed branches
    const getDescendantHandles = useCallback((handle: string): Set<string> => {
        if (!treeData) return new Set();
        const personMap = new Map(treeData.people.map(p => [p.handle, p]));
        const familyMap = new Map(treeData.families.map(f => [f.handle, f]));
        const result = new Set<string>();
        function walk(h: string) {
            const person = personMap.get(h);
            if (!person) return;
            for (const fId of person.families) {
                const fam = familyMap.get(fId);
                if (!fam) continue;
                // Include spouse
                if (fam.motherHandle && fam.motherHandle !== h) result.add(fam.motherHandle);
                if (fam.fatherHandle && fam.fatherHandle !== h) result.add(fam.fatherHandle);
                for (const ch of fam.children) {
                    result.add(ch);
                    walk(ch);
                }
            }
        }
        walk(handle);
        return result;
    }, [treeData]);

    // F4: Compute all hidden handles from collapsed branches
    const hiddenHandles = useMemo(() => {
        if (!treeData) return new Set<string>();
        const hidden = new Set<string>();
        for (const h of collapsedBranches) {
            const descendants = getDescendantHandles(h);
            for (const d of descendants) hidden.add(d);
        }
        // Cascade: hide people whose ALL parent families have hidden fathers
        // This catches nodes that leaked through (e.g., gen 13 whose gen 12 parents are hidden)
        const familyMap = new Map(treeData.families.map(f => [f.handle, f]));
        let changed = true;
        while (changed) {
            changed = false;
            for (const p of treeData.people) {
                if (hidden.has(p.handle)) continue;
                if (p.parentFamilies.length === 0) continue;
                // Check if ALL parent families have their father/mother hidden
                const allParentsHidden = p.parentFamilies.every(pfId => {
                    const pf = familyMap.get(pfId);
                    if (!pf) return true; // orphan family = treat as hidden
                    const fatherHidden = pf.fatherHandle ? hidden.has(pf.fatherHandle) : true;
                    const motherHidden = pf.motherHandle ? hidden.has(pf.motherHandle) : true;
                    return fatherHidden && motherHidden;
                });
                if (allParentsHidden) {
                    hidden.add(p.handle);
                    changed = true;
                }
            }
        }
        return hidden;
    }, [collapsedBranches, getDescendantHandles, treeData]);

    // F4: Branch summaries for collapsed branches
    const branchSummaries = useMemo(() => {
        if (!treeData) return new Map<string, BranchSummary>();
        const map = new Map<string, BranchSummary>();
        for (const h of collapsedBranches) {
            map.set(h, computeBranchSummary(h, treeData.people, treeData.families));
        }
        return map;
    }, [collapsedBranches, treeData]);

    // F4: Toggle collapse — reveals one level at a time when expanding
    const toggleCollapse = useCallback((handle: string) => {
        if (!treeData) return;
        setCollapsedBranches(prev => {
            const next = new Set(prev);
            if (next.has(handle)) {
                // Expanding: remove this person's collapse, but auto-collapse their
                // direct children who have descendants (progressive reveal)
                next.delete(handle);
                const person = treeData.people.find(p => p.handle === handle);
                if (person) {
                    for (const fId of person.families) {
                        const fam = treeData.families.find(f => f.handle === fId);
                        if (!fam) continue;
                        for (const ch of fam.children) {
                            // Check if child has their own children
                            const childPerson = treeData.people.find(p => p.handle === ch);
                            if (childPerson) {
                                const childHasChildren = childPerson.families.some(cfId => {
                                    const cf = treeData.families.find(f => f.handle === cfId);
                                    return cf && cf.children.length > 0;
                                });
                                if (childHasChildren) {
                                    next.add(ch);
                                }
                            }
                        }
                    }
                }
            } else {
                next.add(handle);
            }
            return next;
        });
    }, [treeData]);

    // Expand All / Collapse All
    const expandAll = useCallback(() => {
        setCollapsedBranches(new Set());
    }, []);

    const collapseAll = useCallback(() => {
        if (!treeData) return;
        const allParents = new Set<string>();
        for (const f of treeData.families) {
            if (f.children.length > 0) {
                if (f.fatherHandle) allParents.add(f.fatherHandle);
                if (f.motherHandle) allParents.add(f.motherHandle);
            }
        }
        setCollapsedBranches(allParents);
    }, [treeData]);

    // Auto-collapse for Toàn cảnh view
    const autoCollapseForPanoramic = useCallback(() => {
        if (!treeData) return;
        const gens = computePersonGenerations(treeData.people, treeData.families);
        const toCollapse = new Set<string>();
        for (const f of treeData.families) {
            if (f.children.length === 0) continue;
            const parentHandle = f.fatherHandle || f.motherHandle;
            if (!parentHandle) continue;
            const gen = gens.get(parentHandle);
            if (gen !== undefined && gen >= AUTO_COLLAPSE_GEN) {
                toCollapse.add(parentHandle);
            }
        }
        setCollapsedBranches(toCollapse);
    }, [treeData]);

    // Auto-collapse for Hậu duệ view: collapse branches beyond AUTO_COLLAPSE_GEN relative depth from focus
    const autoCollapseForDescendant = useCallback((person: string) => {
        if (!treeData) return;
        const personMap = new Map(treeData.people.map(p => [p.handle, p]));
        const toCollapse = new Set<string>();
        // BFS from person to compute relative depth
        const depthMap = new Map<string, number>();
        const queue: string[] = [person];
        depthMap.set(person, 0);
        while (queue.length > 0) {
            const h = queue.shift()!;
            const depth = depthMap.get(h)!;
            const p = personMap.get(h);
            if (!p) continue;
            for (const fId of p.families) {
                const fam = treeData.families.find(f => f.handle === fId);
                if (!fam || fam.children.length === 0) continue;
                if (depth >= AUTO_COLLAPSE_GEN) {
                    toCollapse.add(h);
                } else {
                    for (const ch of fam.children) {
                        if (!depthMap.has(ch)) {
                            depthMap.set(ch, depth + 1);
                            queue.push(ch);
                        }
                    }
                }
            }
        }
        setCollapsedBranches(toCollapse);
    }, [treeData]);

    // Compute layout — filter out hidden nodes from collapsed branches
    const layout = useMemo<LayoutResult | null>(() => {
        if (!displayData) return null;
        const d = 'filteredPeople' in displayData
            ? { people: (displayData as any).filteredPeople, families: (displayData as any).filteredFamilies }
            : displayData;
        // F4: Filter out hidden handles
        const visiblePeople = d.people.filter((p: TreeNode) => !hiddenHandles.has(p.handle));
        const visibleFamilies = d.families.filter((f: TreeFamily) => {
            // Keep family only if NOT all parents are hidden
            const fatherHidden = f.fatherHandle ? hiddenHandles.has(f.fatherHandle) : true;
            const motherHidden = f.motherHandle ? hiddenHandles.has(f.motherHandle) : true;
            return !(fatherHidden && motherHidden);
        });
        return computeLayout(visiblePeople, visibleFamilies);
    }, [displayData, hiddenHandles]);

    // F4: Check if a person has children (for showing toggle button)
    const hasChildren = useCallback((handle: string): boolean => {
        if (!treeData) return false;
        return treeData.families.some(f =>
            (f.fatherHandle === handle || f.motherHandle === handle) && f.children.length > 0
        );
    }, [treeData]);

    // F3: Stats computed from full layout
    const treeStats = useMemo<TreeStats | null>(() => {
        if (!layout || !treeData) return null;
        return computeTreeStats(layout.nodes, treeData.families);
    }, [layout, treeData]);

    // F2: Generation stats for headers
    const generationStats = useMemo(() => {
        if (!layout) return new Map<number, number>();
        const map = new Map<number, number>();
        for (const n of layout.nodes) {
            const gen = n.generation + 1;
            map.set(gen, (map.get(gen) ?? 0) + 1);
        }
        return map;
    }, [layout]);

    // ═══ Viewport culling: only render visible nodes ═══
    const CULL_PAD = 300; // px padding around viewport

    const visibleNodes = useMemo(() => {
        if (!layout || !viewportRef.current) return layout?.nodes ?? [];
        const vw = viewportRef.current.clientWidth;
        const vh = viewportRef.current.clientHeight;
        const { x: tx, y: ty, scale } = transform;
        // Convert viewport rect to tree-space coordinates
        const left = (-tx / scale) - CULL_PAD;
        const top = (-ty / scale) - CULL_PAD;
        const right = ((vw - tx) / scale) + CULL_PAD;
        const bottom = ((vh - ty) / scale) + CULL_PAD;
        return layout.nodes.filter(n =>
            n.x + CARD_W >= left && n.x <= right &&
            n.y + CARD_H >= top && n.y <= bottom
        );
    }, [layout, transform]);

    const visibleHandles = useMemo(() => new Set(visibleNodes.map(n => n.node.handle)), [visibleNodes]);

    // Batched SVG paths for connections
    const { parentPaths, couplePaths, visibleCouples } = useMemo(() => {
        if (!layout) return { parentPaths: '', couplePaths: '', visibleCouples: [] as PositionedCouple[] };
        let pp = '';
        let cp = '';
        const vc: PositionedCouple[] = [];
        // Only render connections where at least one endpoint is visible
        for (const c of layout.connections) {
            // Check if any endpoint is near visible area
            const vw = viewportRef.current?.clientWidth ?? 1200;
            const vh = viewportRef.current?.clientHeight ?? 900;
            const { x: tx, y: ty, scale } = transform;
            const left = (-tx / scale) - CULL_PAD;
            const top = (-ty / scale) - CULL_PAD;
            const right = ((vw - tx) / scale) + CULL_PAD;
            const bottom = ((vh - ty) / scale) + CULL_PAD;
            const inView = (x: number, y: number) =>
                x >= left && x <= right && y >= top && y <= bottom;
            if (!inView(c.fromX, c.fromY) && !inView(c.toX, c.toY)) continue;

            if (c.type === 'couple') {
                cp += `M${c.fromX},${c.fromY}L${c.toX},${c.toY}`;
            } else {
                // Each connection segment is already a single straight line
                // (either horizontal or vertical) from the layout engine
                pp += `M${c.fromX},${c.fromY}L${c.toX},${c.toY}`;
            }
        }
        // Visible couples for hearts
        for (const c of layout.couples) {
            if (visibleHandles.has(c.fatherPos?.node.handle ?? '') || visibleHandles.has(c.motherPos?.node.handle ?? '')) {
                vc.push(c);
            }
        }
        return { parentPaths: pp, couplePaths: cp, visibleCouples: vc };
    }, [layout, transform, visibleHandles]);

    // Stable callbacks for PersonCard
    const handleCardHover = useCallback((h: string | null) => setHoveredHandle(h), []);
    const handleCardClick = useCallback((handle: string, x: number, y: number) => {
        if (editorMode) {
            setSelectedCard(handle);
            return;
        }
        setContextMenu({ handle, x, y });
    }, [editorMode]);
    const handleCardFocus = useCallback((handle: string) => {
        setFocusPerson(handle);
    }, []);

    // Search highlight
    useEffect(() => {
        if (!searchQuery || !treeData) { setHighlightHandles(new Set()); return; }
        const q = searchQuery.toLowerCase();
        setHighlightHandles(new Set(treeData.people.filter(p => p.displayName.toLowerCase().includes(q)).map(p => p.handle)));
    }, [searchQuery, treeData]);

    // Fit all
    const fitAll = useCallback(() => {
        if (!layout || !viewportRef.current) return;
        const vw = viewportRef.current.clientWidth;
        const vh = viewportRef.current.clientHeight;
        const pad = 40;
        const tw = layout.width + pad * 2;
        const th = layout.height + pad * 2;
        const scale = Math.max(Math.min(vw / tw, vh / th, 1.2), 0.12);
        setTransform({
            x: (vw - layout.width * scale) / 2,
            y: (vh - layout.height * scale) / 2,
            scale,
        });
    }, [layout]);

    // Auto-fit on first load
    useEffect(() => {
        if (layout && !loading) setTimeout(fitAll, 50);
    }, [layout, loading]); // eslint-disable-line

    // === Mouse handlers ===
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        dragRef.current = { startX: e.clientX, startY: e.clientY, startTx: transform.x, startTy: transform.y };
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setTransform(t => ({ ...t, x: dragRef.current.startTx + dx, y: dragRef.current.startTy + dy }));
    };
    const handleMouseUp = () => setIsDragging(false);

    // === Scroll-wheel zoom ===
    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setTransform(t => {
                const newScale = Math.min(Math.max(t.scale * delta, 0.15), 3);
                const ratio = newScale / t.scale;
                return { scale: newScale, x: mx - (mx - t.x) * ratio, y: my - (my - t.y) * ratio };
            });
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    // === Touch handlers ===
    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;

        let touching = false;
        let lastTouches: Touch[] = [];

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                touching = true;
                const t = e.touches[0];
                dragRef.current = { startX: t.clientX, startY: t.clientY, startTx: transform.x, startTy: transform.y };
            } else if (e.touches.length === 2) {
                const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                pinchRef.current = { initialDist: dist, initialScale: transform.scale };
            }
            lastTouches = Array.from(e.touches);
        };

        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            if (e.touches.length === 1 && touching) {
                const t = e.touches[0];
                const dx = t.clientX - dragRef.current.startX;
                const dy = t.clientY - dragRef.current.startY;
                setTransform(prev => ({ ...prev, x: dragRef.current.startTx + dx, y: dragRef.current.startTy + dy }));
            } else if (e.touches.length === 2) {
                const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                const ratio = dist / pinchRef.current.initialDist;
                const newScale = Math.min(Math.max(pinchRef.current.initialScale * ratio, 0.15), 3);

                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const rect = el.getBoundingClientRect();
                const mx = midX - rect.left;
                const my = midY - rect.top;

                setTransform(prev => {
                    const r = newScale / prev.scale;
                    return { scale: newScale, x: mx - (mx - prev.x) * r, y: my - (my - prev.y) * r };
                });
            }
            lastTouches = Array.from(e.touches);
        };

        const onTouchEnd = () => { touching = false; };

        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd);
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [transform.x, transform.y, transform.scale]);

    // Pan to person
    const panToPerson = useCallback((handle: string) => {
        if (!layout || !viewportRef.current) return;
        const node = layout.nodes.find(n => n.node.handle === handle);
        if (!node) return;
        const vw = viewportRef.current.clientWidth;
        const vh = viewportRef.current.clientHeight;
        setTransform(t => ({
            ...t,
            x: vw / 2 - (node.x + CARD_W / 2) * t.scale,
            y: vh / 2 - (node.y + CARD_H / 2) * t.scale,
        }));
        setFocusPerson(handle);
    }, [layout]);

    // View mode
    const changeViewMode = (mode: ViewMode) => {
        if (mode !== 'full' && !focusPerson && treeData?.people[0]) setFocusPerson(treeData.people[0].handle);
        setViewMode(mode);
        // Auto-collapse based on view mode
        if (mode === 'full') {
            autoCollapseForPanoramic();
        } else if (mode === 'descendant') {
            const person = focusPerson || treeData?.people[0]?.handle;
            if (person) autoCollapseForDescendant(person);
        } else {
            setCollapsedBranches(new Set());
        }
    };

    // Copy shareable link
    const copyTreeLink = useCallback((handle: string) => {
        const url = `${window.location.origin}/tree?view=descendant&person=${handle}`;
        navigator.clipboard.writeText(url).then(() => {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        });
    }, []);

    // Search results
    const searchResults = useMemo(() => {
        if (!searchQuery || !treeData) return [];
        const q = searchQuery.toLowerCase();
        return treeData.people.filter(p => p.displayName.toLowerCase().includes(q)).slice(0, 8);
    }, [searchQuery, treeData]);

    // connPath kept for compatibility but unused with batched rendering

    return (
        <div className="flex flex-col h-[calc(100vh-80px)]">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 px-1 pb-2">
                <div>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <TreePine className="h-5 w-5" /> Cây gia phả
                    </h1>
                    <p className="text-muted-foreground text-xs">
                        {layout ? `${layout.nodes.length} thành viên` : 'Đang tải...'}
                        {viewMode !== 'full' && focusPerson && (
                            <span className="ml-1 text-blue-500">
                                • {viewMode === 'ancestor' ? 'Tổ tiên' : 'Hậu duệ'} của{' '}
                                {treeData?.people.find(p => p.handle === focusPerson)?.displayName}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* View modes */}
                    <div className="flex rounded-lg border overflow-hidden text-xs">
                        {([['full', 'Toàn cảnh', Eye], ['ancestor', 'Tổ tiên', Users], ['descendant', 'Hậu duệ', GitBranch]] as const).map(([mode, label, Icon]) => (
                            <button key={mode} onClick={() => changeViewMode(mode)}
                                className={`px-2.5 py-1.5 font-medium flex items-center gap-1 transition-colors ${mode !== 'full' ? 'border-l' : ''} ${viewMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                                <Icon className="h-3.5 w-3.5" /> {label}
                            </button>
                        ))}
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <div className="relative w-44">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="Tìm kiếm..." value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
                                onFocus={() => setShowSearch(true)} className="pl-8 h-8 text-xs" />
                        </div>
                        {showSearch && searchResults.length > 0 && (
                            <Card className="absolute z-50 w-56 right-0 top-10 shadow-lg">
                                <CardContent className="p-1 max-h-52 overflow-y-auto">
                                    {searchResults.map(p => (
                                        <button key={p.handle} onClick={() => {
                                            setFocusPerson(p.handle);
                                            setViewMode('descendant');
                                            autoCollapseForDescendant(p.handle);
                                            setShowSearch(false);
                                            setSearchQuery('');
                                        }}
                                            className="w-full text-left px-2.5 py-1.5 rounded text-xs hover:bg-accent transition-colors flex justify-between">
                                            <span className="font-medium">{p.displayName}</span>
                                            <span className="text-muted-foreground">{'generation' in p ? `Đời ${(p as any).generation}` : ''}{p.isPrivacyFiltered ? ' 🔒' : ''}</span>
                                        </button>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                    {/* Controls */}
                    <div className="flex gap-0.5">
                        <Button variant="outline" size="icon" className="h-8 w-8" title="Thu gọn tất cả" onClick={collapseAll}><ChevronsDownUp className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" title="Mở rộng tất cả" onClick={expandAll}><ChevronsUpDown className="h-3.5 w-3.5" /></Button>
                        <div className="w-px bg-border mx-0.5" />
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTransform(t => {
                            const vw = viewportRef.current?.clientWidth ?? 0; const vh = viewportRef.current?.clientHeight ?? 0;
                            const cx = vw / 2; const cy = vh / 2;
                            const ns = Math.min(t.scale * 1.3, 3); const r = ns / t.scale;
                            return { scale: ns, x: cx - (cx - t.x) * r, y: cy - (cy - t.y) * r };
                        })}><ZoomIn className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTransform(t => {
                            const vw = viewportRef.current?.clientWidth ?? 0; const vh = viewportRef.current?.clientHeight ?? 0;
                            const cx = vw / 2; const cy = vh / 2;
                            const ns = Math.max(t.scale / 1.3, 0.15); const r = ns / t.scale;
                            return { scale: ns, x: cx - (cx - t.x) * r, y: cy - (cy - t.y) * r };
                        })}><ZoomOut className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={fitAll}><Maximize2 className="h-3.5 w-3.5" /></Button>
                        <div className="w-px bg-border mx-0.5" />
                        {isAdmin && (
                            <Button
                                variant={editorMode ? 'default' : 'outline'}
                                size="icon"
                                className={`h-8 w-8 ${editorMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                                title={editorMode ? 'Tắt chỉnh sửa' : 'Chế độ chỉnh sửa'}
                                onClick={() => { setEditorMode(m => !m); setSelectedCard(null); }}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Tree viewport + Editor panel row */}
            <div className="flex-1 flex gap-0 min-h-0">
                <div ref={viewportRef}
                    className="flex-1 relative overflow-hidden rounded-xl border-2 bg-gradient-to-br from-background to-muted/30 cursor-grab active:cursor-grabbing select-none"
                    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                    onClick={() => { setShowSearch(false); setContextMenu(null); if (editorMode) setSelectedCard(null); }}
                >
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : layout && (
                        <div style={{
                            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                            transformOrigin: '0 0', width: layout.width, height: layout.height,
                            position: 'absolute', top: 0, left: 0,
                        }}>
                            {/* SVG connections — batched into 2 paths */}
                            <svg className="absolute inset-0 pointer-events-none" width={layout.width} height={layout.height}
                                style={{ overflow: 'visible' }}>
                                {parentPaths && <path d={parentPaths} stroke="#94a3b8" strokeWidth={1.5} fill="none" />}
                                {couplePaths && <path d={couplePaths} stroke="#cbd5e1" strokeWidth={1.5} fill="none" strokeDasharray="4,3" />}
                                {/* Couple hearts — only visible */}
                                {visibleCouples.map(c => (
                                    <text key={c.familyHandle}
                                        x={c.midX} y={c.y + CARD_H / 2 + 4}
                                        textAnchor="middle" fontSize="10" fill="#e11d48">❤</text>
                                ))}
                            </svg>

                            {/* DOM nodes — only visible (culled) */}
                            {visibleNodes.map(item => (
                                <MemoPersonCard key={item.node.handle} item={item}
                                    isHighlighted={highlightHandles.has(item.node.handle)}
                                    isFocused={focusPerson === item.node.handle}
                                    isHovered={hoveredHandle === item.node.handle}
                                    isSelected={editorMode && selectedCard === item.node.handle}
                                    zoomLevel={zoomLevel}
                                    showCollapseToggle={hasChildren(item.node.handle)}
                                    isCollapsed={collapsedBranches.has(item.node.handle)}
                                    onHover={handleCardHover}
                                    onClick={handleCardClick}
                                    onSetFocus={handleCardFocus}
                                    onToggleCollapse={toggleCollapse}
                                />
                            ))}

                            {/* F4: Branch summary cards for collapsed nodes */}
                            {Array.from(branchSummaries.entries()).map(([handle, summary]) => {
                                const parentNode = layout.nodes.find(n => n.node.handle === handle);
                                if (!parentNode) return null;
                                return (
                                    <BranchSummaryCard
                                        key={`summary-${handle}`}
                                        summary={summary}
                                        parentNode={parentNode}
                                        zoomLevel={zoomLevel}
                                        onExpand={() => toggleCollapse(handle)}
                                    />
                                );
                            })}

                            {/* Context menu on card */}
                            {contextMenu && (() => {
                                const person = treeData?.people.find(p => p.handle === contextMenu.handle);
                                if (!person) return null;
                                return (
                                    <CardContextMenu
                                        person={person}
                                        x={contextMenu.x}
                                        y={contextMenu.y}
                                        onViewDetail={() => { router.push(`/people/${person.handle}`); setContextMenu(null); }}
                                        onShowDescendants={() => { setFocusPerson(person.handle); setViewMode('descendant'); setContextMenu(null); }}
                                        onShowAncestors={() => { setFocusPerson(person.handle); setViewMode('ancestor'); setContextMenu(null); }}
                                        onSetFocus={() => { panToPerson(person.handle); setContextMenu(null); }}
                                        onShowFull={() => { setViewMode('full'); setContextMenu(null); }}
                                        onCopyLink={() => { copyTreeLink(person.handle); setContextMenu(null); }}
                                        onContribute={() => { setContributePerson({ handle: person.handle, name: person.displayName }); setContextMenu(null); }}
                                        onClose={() => setContextMenu(null)}
                                    />
                                );
                            })()}
                        </div>
                    )}

                    {/* F2: Generation Row Headers */}
                    {layout && (
                        <GenerationHeaders
                            generationStats={generationStats}
                            transform={transform}
                            cardH={CARD_H}
                        />
                    )}

                    {/* F3: Stats Overlay Panel */}
                    {treeStats && zoomLevel === 'mini' && !statsHidden && (
                        <StatsOverlay stats={treeStats} onClose={() => setStatsHidden(true)} />
                    )}

                    {/* Zoom + culling indicator */}
                    <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur border rounded px-1.5 py-0.5 text-[10px] text-muted-foreground flex gap-1.5">
                        <span>{Math.round(transform.scale * 100)}%</span>
                        {layout && <span className="opacity-60">·</span>}
                        {layout && <span>{visibleNodes.length}/{layout.nodes.length} nodes</span>}
                    </div>

                    {/* Focus person selector */}
                    {viewMode !== 'full' && treeData && (
                        <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur border rounded-lg px-2 py-1.5 flex items-center gap-1.5 text-xs">
                            <span className="text-muted-foreground">Gốc:</span>
                            <select value={focusPerson || ''} onChange={e => setFocusPerson(e.target.value)}
                                className="border rounded px-1.5 py-0.5 text-xs bg-background max-w-[140px]">
                                {treeData.people.map(p => (
                                    <option key={p.handle} value={p.handle}>{p.displayName}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Link copied toast */}
                    {linkCopied && (
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
                            <Copy className="w-3.5 h-3.5" /> Đã sao chép link!
                        </div>
                    )}
                </div>

                {/* Editor Sidebar Panel */}
                {editorMode && (
                    <EditorPanel
                        selectedCard={selectedCard}
                        treeData={treeData}
                        onReorderChildren={(familyHandle, newOrder) => {
                            setTreeData(prev => prev ? {
                                ...prev,
                                families: prev.families.map(f => f.handle === familyHandle ? { ...f, children: newOrder } : f)
                            } : null);
                            supaUpdateFamilyChildren(familyHandle, newOrder);
                        }}
                        onMoveChild={(childHandle, fromFamily, toFamily) => {
                            setTreeData(prev => {
                                if (!prev) return null;
                                const families = prev.families.map(f => {
                                    if (f.handle === fromFamily) return { ...f, children: f.children.filter(c => c !== childHandle) };
                                    if (f.handle === toFamily) return { ...f, children: [...f.children, childHandle] };
                                    return f;
                                });
                                supaMoveChild(childHandle, fromFamily, toFamily, prev.families);
                                return { ...prev, families };
                            });
                        }}
                        onRemoveChild={(childHandle, familyHandle) => {
                            setTreeData(prev => {
                                if (!prev) return null;
                                const families = prev.families.map(f =>
                                    f.handle === familyHandle ? { ...f, children: f.children.filter(c => c !== childHandle) } : f
                                );
                                supaRemoveChild(childHandle, familyHandle, prev.families);
                                return { ...prev, families };
                            });
                        }}
                        onToggleLiving={(handle, isLiving) => {
                            setTreeData(prev => prev ? {
                                ...prev,
                                people: prev.people.map(p => p.handle === handle ? { ...p, isLiving } : p)
                            } : null);
                            supaUpdatePersonLiving(handle, isLiving);
                        }}
                        onUpdatePerson={(handle, fields) => {
                            setTreeData(prev => {
                                if (!prev) return null;
                                return {
                                    ...prev,
                                    people: prev.people.map(p => p.handle === handle ? { ...p, ...fields } : p)
                                };
                            });
                            supaUpdatePerson(handle, fields);
                        }}
                        onReset={async () => {
                            const data = await fetchTreeData();
                            setTreeData(data);
                        }}
                        onClose={() => { setEditorMode(false); setSelectedCard(null); }}
                    />
                )}
            </div>

            {/* Legend */}
            <div className="flex gap-3 text-[10px] text-muted-foreground pt-1.5 px-1 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-400" /> Nam (chính tộc)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-pink-100 border border-pink-400" /> Nữ (chính tộc)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-dashed border-slate-300" /> Ngoại tộc</span>
                <span className="flex items-center gap-1"><span className="text-red-500">❤</span> Vợ chồng</span>
                <span className="flex items-center gap-1 opacity-60"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 border border-slate-400" /> Đã mất</span>
                <span className="ml-auto opacity-50">Cuộn để zoom • Kéo để di chuyển • Nhấn để xem</span>
            </div>
            {/* Contribute dialog */}
            {contributePerson && (
                <ContributeDialog
                    personHandle={contributePerson.handle}
                    personName={contributePerson.name}
                    onClose={() => setContributePerson(null)}
                />
            )}
        </div>
    );
}

// === Card Context Menu ===
function CardContextMenu({ person, x, y, onViewDetail, onShowDescendants, onShowAncestors, onSetFocus, onShowFull, onCopyLink, onContribute, onClose }: {
    person: TreeNode;
    x: number;
    y: number;
    onViewDetail: () => void;
    onShowDescendants: () => void;
    onShowAncestors: () => void;
    onSetFocus: () => void;
    onShowFull: () => void;
    onCopyLink: () => void;
    onContribute: () => void;
    onClose: () => void;
}) {
    return (
        <div
            className="absolute z-50 animate-in fade-in zoom-in-95 duration-150"
            style={{ left: x + 8, top: y + 8 }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="bg-white/95 backdrop-blur-lg border border-slate-200 rounded-xl shadow-xl
                py-1.5 min-w-[200px] overflow-hidden">
                {/* Header */}
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                            ${person.isPatrilineal
                                ? (person.gender === 1 ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700')
                                : 'bg-slate-100 text-slate-500'}`}>
                            {person.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-sm font-semibold text-slate-800 truncate max-w-[130px]">{person.displayName}</span>
                    </div>
                    <button onClick={onClose} className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Actions */}
                <div className="py-1">
                    <MenuAction icon={<User className="w-4 h-4" />} label="Xem chi tiết" desc="Mở trang cá nhân" onClick={onViewDetail} />
                    <MenuAction icon={<ArrowDownToLine className="w-4 h-4" />} label="Hậu duệ từ đây" desc="Hiển thị cây con cháu" onClick={onShowDescendants} />
                    <MenuAction icon={<ArrowUpFromLine className="w-4 h-4" />} label="Tổ tiên" desc="Hiển thị dòng tổ tiên" onClick={onShowAncestors} />
                    <MenuAction icon={<Crosshair className="w-4 h-4" />} label="Căn giữa" desc="Di chuyển tới vị trí" onClick={onSetFocus} />
                    <div className="border-t border-slate-100 my-1" />
                    <MenuAction icon={<Link className="w-4 h-4" />} label="Sao chép link hậu duệ" desc="Chia sẻ link cây con cháu" onClick={onCopyLink} />
                    <MenuAction icon={<Eye className="w-4 h-4" />} label="Toàn cảnh" desc="Hiển thị toàn bộ cây" onClick={onShowFull} />
                    <div className="border-t border-slate-100 my-1" />
                    <MenuAction icon={<MessageSquarePlus className="w-4 h-4" />} label="Đóng góp thông tin" desc="Bổ sung thông tin về người này" onClick={onContribute} />
                </div>
            </div>
        </div>
    );
}

function MenuAction({ icon, label, desc, onClick }: { icon: React.ReactNode; label: string; desc: string; onClick: () => void }) {
    return (
        <button
            className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 active:bg-slate-100
                transition-colors text-left group"
            onClick={onClick}
        >
            <span className="text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-700 group-hover:text-slate-900">{label}</p>
                <p className="text-[10px] text-slate-400">{desc}</p>
            </div>
        </button>
    );
}

// === Person Card Component (memoized) ===
const MemoPersonCard = memo(PersonCard, (prev, next) =>
    prev.item === next.item &&
    prev.isHighlighted === next.isHighlighted &&
    prev.isFocused === next.isFocused &&
    prev.isHovered === next.isHovered &&
    prev.isSelected === next.isSelected &&
    prev.zoomLevel === next.zoomLevel &&
    prev.showCollapseToggle === next.showCollapseToggle &&
    prev.isCollapsed === next.isCollapsed
);

function PersonCard({ item, isHighlighted, isFocused, isHovered, isSelected, zoomLevel, showCollapseToggle, isCollapsed, onHover, onClick, onSetFocus, onToggleCollapse }: {
    item: PositionedNode;
    isHighlighted: boolean;
    isFocused: boolean;
    isHovered: boolean;
    isSelected: boolean;
    zoomLevel: ZoomLevel;
    showCollapseToggle: boolean;
    isCollapsed: boolean;
    onHover: (h: string | null) => void;
    onClick: (handle: string, x: number, y: number) => void;
    onSetFocus: (handle: string) => void;
    onToggleCollapse: (handle: string) => void;
}) {
    const { node, x, y } = item;
    const isMale = node.gender === 1;
    const isFemale = node.gender === 2;
    const isDead = !node.isLiving;
    const isPatri = node.isPatrilineal;

    // ── Color system ──
    const dotColor = !isPatri ? '#94a3b8' : isMale ? '#818cf8' : isFemale ? '#f472b6' : '#94a3b8';

    // F1: MINI zoom → just a colored dot with tooltip
    if (zoomLevel === 'mini') {
        return (
            <div
                className="absolute group"
                style={{ left: x + CARD_W / 2 - 6, top: y + CARD_H / 2 - 6, width: 12, height: 12 }}
                onMouseEnter={() => onHover(node.handle)}
                onMouseLeave={() => onHover(null)}
                onClick={(e) => { e.stopPropagation(); onClick(node.handle, x + CARD_W, y + CARD_H / 2); }}
            >
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: dotColor }} />
                {/* Tooltip on hover */}
                <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 z-50
                    bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none">
                    {node.displayName} · Đời {item.generation + 1}
                </div>
            </div>
        );
    }

    // Extract initials
    const nameParts = node.displayName.split(' ');
    const initials = nameParts.length >= 2
        ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
        : node.displayName.slice(0, 2).toUpperCase();

    const avatarBg = !isPatri
        ? 'bg-stone-300 text-stone-600'
        : isMale
            ? (isDead ? 'bg-indigo-300 text-indigo-800' : 'bg-indigo-400 text-white')
            : isFemale
                ? (isDead ? 'bg-rose-300 text-rose-800' : 'bg-rose-400 text-white')
                : 'bg-slate-300 text-slate-600';

    const bgClass = !isPatri
        ? 'from-stone-50 to-stone-100 border-stone-300/80 border-dashed'
        : isDead
            ? (isMale
                ? 'from-indigo-50/60 to-slate-50 border-indigo-300/60'
                : 'from-rose-50/60 to-slate-50 border-rose-300/60')
            : isMale
                ? 'from-indigo-50 to-violet-50 border-indigo-300'
                : isFemale
                    ? 'from-rose-50 to-pink-50 border-rose-300'
                    : 'from-slate-50 to-slate-100 border-slate-300';

    const glowClass = isSelected ? 'ring-2 ring-blue-500 ring-offset-2 shadow-blue-200 shadow-lg'
        : isHighlighted ? 'ring-2 ring-amber-400 ring-offset-2'
            : isFocused ? 'ring-2 ring-indigo-400 ring-offset-2'
                : isHovered ? 'ring-1 ring-indigo-200' : '';

    // F1: COMPACT zoom → smaller card with just name + gen
    if (zoomLevel === 'compact') {
        return (
            <div
                className={`absolute rounded-lg border bg-gradient-to-br shadow-sm transition-all duration-200
                    cursor-pointer hover:shadow-md ${bgClass} ${glowClass}
                    ${isDead ? 'opacity-70' : ''} ${!isPatri ? 'opacity-80' : ''}`}
                style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
                onMouseEnter={() => onHover(node.handle)}
                onMouseLeave={() => onHover(null)}
                onClick={(e) => { e.stopPropagation(); onClick(node.handle, x + CARD_W, y + CARD_H / 2); }}
            >
                <div className="px-2 py-1.5 h-full flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center
                        font-bold text-[9px] shadow-sm ring-1 ring-black/5 ${avatarBg} flex-shrink-0`}>
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[10px] leading-tight text-slate-800 truncate">{node.displayName}</p>
                        <span className="text-[8px] font-semibold px-0.5 py-px rounded bg-amber-100 text-amber-700">Đời {item.generation + 1}</span>
                    </div>
                </div>
                {/* Collapse toggle */}
                {showCollapseToggle && (
                    <button
                        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 w-5 h-5 rounded-full
                            bg-white border border-slate-300 shadow-sm flex items-center justify-center
                            hover:bg-slate-100 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.handle); }}
                    >
                        {isCollapsed ? <ChevronRight className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                    </button>
                )}
            </div>
        );
    }

    // F1: FULL zoom → original detailed card
    return (
        <div
            className={`absolute rounded-xl border-[1.5px] bg-gradient-to-br shadow-sm transition-all duration-200
                cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${bgClass} ${glowClass}
                ${isDead ? 'opacity-70' : ''} ${!isPatri ? 'opacity-80' : ''}`}
            style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
            onMouseEnter={() => onHover(node.handle)}
            onMouseLeave={() => onHover(null)}
            onClick={(e) => { e.stopPropagation(); onClick(node.handle, x + CARD_W, y + CARD_H / 2); }}
            onContextMenu={(e) => { e.preventDefault(); onSetFocus(node.handle); }}
        >
            <div className="px-2.5 py-2 h-full flex items-center gap-2.5">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center
                        font-bold text-sm shadow-sm ring-1 ring-black/5 ${avatarBg} ${isDead ? 'opacity-60' : ''}`}>
                        {initials}
                    </div>
                    {isPatri && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500
                            text-white text-[8px] flex items-center justify-center shadow-sm font-bold ring-1 ring-white">Lê</span>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[11px] leading-tight text-slate-800 truncate">
                        {node.displayName}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                        {node.birthYear
                            ? `${node.birthYear}${node.deathYear ? ` — ${node.deathYear}` : node.isLiving ? ' — nay' : ''}`
                            : '—'}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1">
                        <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200/60">Đời {item.generation + 1}</span>
                        {isDead ? (
                            <span className="text-[9px] text-slate-400">✝ Đã mất</span>
                        ) : (
                            <span className="text-[9px] text-emerald-600 font-medium">● Còn sống</span>
                        )}
                        {!isPatri && (
                            <span className="text-[9px] text-slate-400 ml-0.5">· Ngoại tộc</span>
                        )}
                    </div>
                </div>
            </div>

            {/* F4: Collapse toggle button */}
            {showCollapseToggle && (
                <button
                    className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 w-6 h-6 rounded-full
                        bg-white border border-slate-300 shadow-sm flex items-center justify-center
                        hover:bg-amber-50 hover:border-amber-400 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.handle); }}
                    title={isCollapsed ? 'Mở rộng nhánh' : 'Thu gọn nhánh'}
                >
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-amber-600" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                </button>
            )}
        </div>
    );
}

// === F4: Branch Summary Card ===
function BranchSummaryCard({ summary, parentNode, zoomLevel, onExpand }: {
    summary: BranchSummary;
    parentNode: PositionedNode;
    zoomLevel: ZoomLevel;
    onExpand: () => void;
}) {
    const x = parentNode.x;
    const y = parentNode.y + CARD_H + 40; // Position below parent with spacing

    if (zoomLevel === 'mini') {
        return (
            <div
                className="absolute group cursor-pointer"
                style={{ left: x + CARD_W / 2 - 8, top: y + CARD_H / 2 - 8, width: 16, height: 16 }}
                onClick={(e) => { e.stopPropagation(); onExpand(); }}
            >
                <div className="w-4 h-4 rounded bg-amber-400 shadow-sm flex items-center justify-center">
                    <span className="text-[7px] text-white font-bold">{summary.totalDescendants}</span>
                </div>
                <div className="hidden group-hover:block absolute -top-10 left-1/2 -translate-x-1/2 z-50
                    bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none">
                    📦 {summary.totalDescendants} người · Đời {summary.generationRange[0]}→{summary.generationRange[1]}
                </div>
            </div>
        );
    }

    return (
        <div
            className="absolute rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50
                shadow-md cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
        >
            <div className="px-2.5 py-2 h-full flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500
                    flex items-center justify-center shadow-sm flex-shrink-0">
                    <Package className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[11px] leading-tight text-amber-900">
                        📦 {summary.totalDescendants} người
                    </p>
                    <p className="text-[10px] text-amber-700 mt-0.5">
                        Đời {summary.generationRange[0]} → {summary.generationRange[1]}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[9px]">
                        <span className="text-emerald-600 font-medium">● {summary.livingCount}</span>
                        <span className="text-slate-400">✝ {summary.deceasedCount}</span>
                        <span className="text-amber-600 ml-auto text-[8px] font-medium">▶ Mở</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// === F2: Generation Row Headers ===
function GenerationHeaders({ generationStats, transform, cardH }: {
    generationStats: Map<number, number>;
    transform: { x: number; y: number; scale: number };
    cardH: number;
}) {
    const V_SPACE = 80; // Must match tree-layout.ts V_SPACE
    const entries = Array.from(generationStats.entries()).sort((a, b) => a[0] - b[0]);
    if (entries.length === 0) return null;

    return (
        <div className="absolute left-0 top-0 bottom-0 overflow-hidden pointer-events-none" style={{ width: 100 }}>
            {entries.map(([gen, count]) => {
                const rowY = (gen - 1) * (cardH + V_SPACE);
                const screenY = rowY * transform.scale + transform.y;
                // Only render if in viewport
                if (screenY < -60 || screenY > 2000) return null;
                return (
                    <div
                        key={gen}
                        className="absolute left-0 flex items-center text-[10px] transition-transform duration-100"
                        style={{
                            top: screenY + (cardH * transform.scale) / 2 - 10,
                            height: 20,
                        }}
                    >
                        <div className="bg-slate-800/70 backdrop-blur text-white px-2 py-0.5 rounded-r-md
                            font-medium whitespace-nowrap shadow-sm">
                            Đ{gen} <span className="opacity-70">· {count}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// === F3: Stats Overlay Panel ===
function StatsOverlay({ stats, onClose }: { stats: TreeStats; onClose: () => void }) {
    const maxCount = Math.max(...stats.perGeneration.map(g => g.count));

    return (
        <div className="absolute top-3 right-3 w-64 bg-white/95 backdrop-blur-lg border border-slate-200
            rounded-xl shadow-xl animate-in slide-in-from-right-5 fade-in duration-300 z-40 pointer-events-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-indigo-500" />
                    <span className="font-semibold text-sm text-slate-800">Tổng quan</span>
                </div>
                <button onClick={onClose} className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="p-3 space-y-3">
                {/* Summary numbers */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                        <p className="text-lg font-bold text-slate-800">{stats.total}</p>
                        <p className="text-[9px] text-slate-500">Thành viên</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-800">{stats.totalGenerations}</p>
                        <p className="text-[9px] text-slate-500">Thế hệ</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-800">{stats.totalFamilies}</p>
                        <p className="text-[9px] text-slate-500">Gia đình</p>
                    </div>
                </div>

                {/* Generation distribution */}
                <div>
                    <p className="text-[10px] font-semibold text-slate-600 mb-1.5">Phân bố theo đời</p>
                    <div className="space-y-1">
                        {stats.perGeneration.map(({ gen, count }) => (
                            <div key={gen} className="flex items-center gap-1.5 text-[10px]">
                                <span className="w-6 text-right text-slate-500 font-mono">Đ{gen}</span>
                                <div className="flex-1 h-3 bg-slate-100 rounded-sm overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-400 to-violet-500 rounded-sm transition-all"
                                        style={{ width: `${(count / maxCount) * 100}%` }}
                                    />
                                </div>
                                <span className="w-6 text-slate-600 font-medium">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Status breakdown */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-slate-600">Còn sống</span>
                        <span className="ml-auto font-medium text-slate-800">{stats.livingCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                        <span className="text-slate-600">Đã mất</span>
                        <span className="ml-auto font-medium text-slate-800">{stats.deceasedCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                        <span className="text-slate-600">Chính tộc</span>
                        <span className="ml-auto font-medium text-slate-800">{stats.patrilinealCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-stone-300" />
                        <span className="text-slate-600">Ngoại tộc</span>
                        <span className="ml-auto font-medium text-slate-800">{stats.nonPatrilinealCount}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// === Editor Panel Component ===
function EditorPanel({ selectedCard, treeData, onReorderChildren, onMoveChild, onRemoveChild, onToggleLiving, onUpdatePerson, onReset, onClose }: {
    selectedCard: string | null;
    treeData: { people: TreeNode[]; families: TreeFamily[] } | null;
    onReorderChildren: (familyHandle: string, newOrder: string[]) => void;
    onMoveChild: (childHandle: string, fromFamily: string, toFamily: string) => void;
    onRemoveChild: (childHandle: string, familyHandle: string) => void;
    onToggleLiving: (handle: string, isLiving: boolean) => void;
    onUpdatePerson: (handle: string, fields: Record<string, unknown>) => void;
    onReset: () => void;
    onClose: () => void;
}) {
    const [editName, setEditName] = useState('');
    const [editBirthYear, setEditBirthYear] = useState('');
    const [editDeathYear, setEditDeathYear] = useState('');
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [parentSearch, setParentSearch] = useState('');
    const [showParentDropdown, setShowParentDropdown] = useState(false);
    const parentSearchRef = useRef<HTMLDivElement>(null);

    if (!treeData) return null;

    const person = selectedCard ? treeData.people.find(p => p.handle === selectedCard) : null;

    // Sync local state when selection changes
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        if (person) {
            setEditName(person.displayName || '');
            setEditBirthYear(person.birthYear?.toString() || '');
            setEditDeathYear(person.deathYear?.toString() || '');
            setDirty(false);
            setParentSearch('');
            setShowParentDropdown(false);
        }
    }, [person?.handle]);

    // Close parent dropdown on outside click
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (parentSearchRef.current && !parentSearchRef.current.contains(e.target as Node)) {
                setShowParentDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Find the family where this person is a parent
    const parentFamily = person
        ? treeData.families.find(f => f.fatherHandle === person.handle || f.motherHandle === person.handle)
        : null;

    // Find the family where this person is a child
    const childOfFamily = person
        ? treeData.families.find(f => f.children.includes(person.handle))
        : null;

    // Get parent person name
    const parentPerson = childOfFamily
        ? treeData.people.find(p => p.handle === childOfFamily.fatherHandle || p.handle === childOfFamily.motherHandle)
        : null;

    // Children of the selected person's family
    const children = parentFamily
        ? parentFamily.children.map(ch => treeData.people.find(p => p.handle === ch)).filter(Boolean) as TreeNode[]
        : [];

    // All families (for "change parent" dropdown) with labels
    const allParentFamilies = treeData.families.filter(f => f.fatherHandle || f.motherHandle);
    const parentFamiliesWithLabels = allParentFamilies.map(f => {
        const father = treeData.people.find(p => p.handle === f.fatherHandle);
        const gen = father ? (father as any).generation : '';
        const label = father ? father.displayName : f.handle;
        return { ...f, label, gen };
    });

    // Filter parent families by search term
    const filteredParentFamilies = parentSearch.trim()
        ? parentFamiliesWithLabels.filter(f =>
            f.label.toLowerCase().includes(parentSearch.toLowerCase()) ||
            f.handle.toLowerCase().includes(parentSearch.toLowerCase())
        )
        : parentFamiliesWithLabels;

    const handleSave = async () => {
        if (!person || !dirty) return;
        setSaving(true);
        const fields: Record<string, unknown> = {};
        if (editName !== person.displayName) fields.displayName = editName;
        const newBirth = editBirthYear ? parseInt(editBirthYear) : null;
        if (newBirth !== (person.birthYear ?? null)) fields.birthYear = newBirth;
        const newDeath = editDeathYear ? parseInt(editDeathYear) : null;
        if (newDeath !== (person.deathYear ?? null)) fields.deathYear = newDeath;
        if (Object.keys(fields).length > 0) {
            onUpdatePerson(person.handle, fields);
        }
        setDirty(false);
        setSaving(false);
    };

    return (
        <div className="w-72 bg-background border-l flex flex-col overflow-hidden flex-shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-blue-50">
                <div className="flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800">Chỉnh sửa</span>
                </div>
                <div className="flex gap-1">
                    <button onClick={onReset} title="Khôi phục gốc" className="p-1 rounded hover:bg-blue-100 text-blue-600">
                        <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={onClose} className="p-1 rounded hover:bg-blue-100 text-blue-600">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {!person ? (
                <div className="flex-1 flex items-center justify-center p-4">
                    <p className="text-sm text-muted-foreground text-center">
                        Nhấn vào một card trên cây để chọn và chỉnh sửa
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {/* Editable person info */}
                    <div className="p-3 border-b space-y-2">
                        <p className="text-xs text-muted-foreground">Đời {(person as any).generation ?? '?'} · {person.handle}</p>
                        {parentPerson && (
                            <p className="text-xs text-muted-foreground">
                                Cha: <span className="font-medium text-foreground">{parentPerson.displayName}</span>
                            </p>
                        )}

                        {/* Editable Name */}
                        <div>
                            <label className="text-xs text-muted-foreground">Họ tên</label>
                            <input className="w-full border rounded px-2 py-1 text-sm bg-background" value={editName}
                                onChange={e => { setEditName(e.target.value); setDirty(true); }} />
                        </div>

                        {/* Birth / Death Year */}
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-xs text-muted-foreground">Năm sinh</label>
                                <input type="number" className="w-full border rounded px-2 py-1 text-sm bg-background" value={editBirthYear}
                                    onChange={e => { setEditBirthYear(e.target.value); setDirty(true); }} placeholder="—" />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-muted-foreground">Năm mất</label>
                                <input type="number" className="w-full border rounded px-2 py-1 text-sm bg-background" value={editDeathYear}
                                    onChange={e => { setEditDeathYear(e.target.value); setDirty(true); }} placeholder="—" />
                            </div>
                        </div>

                        {/* Living status */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Trạng thái:</span>
                            <button
                                className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${person.isLiving
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                onClick={() => onToggleLiving(person.handle, !person.isLiving)}
                            >
                                {person.isLiving ? '● Còn sống' : '○ Đã mất'}
                            </button>
                        </div>

                        {/* Save button */}
                        {dirty && (
                            <button
                                className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                onClick={handleSave} disabled={saving}
                            >
                                <Save className="h-3.5 w-3.5" />{saving ? 'Đang lưu...' : 'Lưu thay đổi → Supabase'}
                            </button>
                        )}
                    </div>

                    {/* Children reorder */}
                    {parentFamily && children.length > 0 && (
                        <div className="p-3 border-b">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                Con ({children.length})
                            </p>
                            <div className="space-y-1">
                                {children.map((child, idx) => (
                                    <div key={child.handle} className="flex items-center gap-1 group">
                                        <GripVertical className="h-3 w-3 text-muted-foreground/40" />
                                        <span className="flex-1 text-xs truncate">{child.displayName}</span>
                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {idx > 0 && (
                                                <button
                                                    className="p-0.5 rounded hover:bg-muted"
                                                    title="Lên"
                                                    onClick={() => {
                                                        const newOrder = [...parentFamily.children];
                                                        [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                                                        onReorderChildren(parentFamily.handle, newOrder);
                                                    }}
                                                >
                                                    <ArrowUp className="h-3 w-3" />
                                                </button>
                                            )}
                                            {idx < children.length - 1 && (
                                                <button
                                                    className="p-0.5 rounded hover:bg-muted"
                                                    title="Xuống"
                                                    onClick={() => {
                                                        const newOrder = [...parentFamily.children];
                                                        [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                                                        onReorderChildren(parentFamily.handle, newOrder);
                                                    }}
                                                >
                                                    <ArrowDown className="h-3 w-3" />
                                                </button>
                                            )}
                                            <button
                                                className="p-0.5 rounded hover:bg-red-100 text-red-500"
                                                title="Xóa liên kết"
                                                onClick={() => {
                                                    if (confirm(`Xóa "${child.displayName}" khỏi danh sách con?`)) {
                                                        onRemoveChild(child.handle, parentFamily.handle);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Change parent — searchable */}
                    {childOfFamily && (
                        <div className="p-3 border-b" ref={parentSearchRef}>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                Đổi cha
                            </p>
                            {/* Current parent display */}
                            <p className="text-xs text-muted-foreground mb-1">
                                Hiện tại: <span className="font-medium text-foreground">{parentPerson?.displayName ?? childOfFamily.handle}</span>
                            </p>
                            {/* Searchable input */}
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full border rounded px-2 py-1 text-xs bg-background placeholder:text-muted-foreground/60"
                                    placeholder="🔍 Tìm cha mới..."
                                    value={parentSearch}
                                    onChange={e => { setParentSearch(e.target.value); setShowParentDropdown(true); }}
                                    onFocus={() => setShowParentDropdown(true)}
                                />
                                {showParentDropdown && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded shadow-lg max-h-48 overflow-y-auto">
                                        {filteredParentFamilies.length === 0 ? (
                                            <div className="px-2 py-2 text-xs text-muted-foreground text-center">
                                                Không tìm thấy
                                            </div>
                                        ) : (
                                            filteredParentFamilies.map(f => {
                                                const isSelected = f.handle === childOfFamily.handle;
                                                return (
                                                    <button
                                                        key={f.handle}
                                                        className={`w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-1 transition-colors ${isSelected ? 'bg-blue-100 font-semibold text-blue-700' : ''}`}
                                                        onClick={() => {
                                                            if (f.handle !== childOfFamily.handle) {
                                                                onMoveChild(person.handle, childOfFamily.handle, f.handle);
                                                            }
                                                            setShowParentDropdown(false);
                                                            setParentSearch('');
                                                        }}
                                                    >
                                                        <span className="truncate flex-1">{f.label}</span>
                                                        <span className="text-muted-foreground/60 shrink-0">Đ{f.gen}</span>
                                                        {isSelected && <span className="text-blue-600 shrink-0">✓</span>}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
