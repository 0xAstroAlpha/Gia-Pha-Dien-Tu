/**
 * Anchor-Based Tree Layout -- Strict Vertical Lines
 *
 * RULES (bat buoc):
 *  1. Single child -> directly below father (same X column)
 *  2. N children -> evenly distributed around father's X column,
 *     with the father at the center of the children block
 *  3. All parent-child connections are strictly orthogonal
 *     (vertical stub -> horizontal bus -> vertical drops)
 *  4. No diagonal or angled lines
 */

export interface TreeNode {
    handle: string;
    displayName: string;
    gender: number;
    generation: number;
    birthYear?: number;
    deathYear?: number;
    isLiving: boolean;
    isPrivacyFiltered: boolean;
    isPatrilineal: boolean;
    families: string[];
    parentFamilies: string[];
}

export interface TreeFamily {
    handle: string;
    fatherHandle?: string;
    motherHandle?: string;
    children: string[];
}

export interface PositionedNode {
    node: TreeNode;
    x: number;
    y: number;
    generation: number;
}

export interface PositionedCouple {
    familyHandle: string;
    fatherPos?: PositionedNode;
    motherPos?: PositionedNode;
    midX: number;
    y: number;
}

export interface Connection {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    type: 'parent-child' | 'couple';
    /** Used to suppress connector segments when the whole nuclear family is collapsed away. */
    familyHandle?: string;
}

export interface LayoutResult {
    nodes: PositionedNode[];
    couples: PositionedCouple[];
    connections: Connection[];
    width: number;
    height: number;
    generations: number;
}

// Sizing
export const CARD_W = 210;
export const CARD_H = 80;
/** Default horizontal spacing for contours / generic use. */
export const H_SPACE = 36;
/**
 * Gap between different *households* on the same doi (e.g. one married sibling's family vs another's).
 * Spouses + their kids stay tight; cousins' families get this space between them.
 */
export const FAMILY_GROUP_GAP = 4;
/** Gap between sibling child subtrees under the *same* parents (tight nuclear family). */
export const INTRA_FAMILY_SIBLING_GAP = 18;
export const V_SPACE = 80;
/** Default horizontal gap between vo/chong cards (heart sits in this gap); use getCoupleGapForFamily for dynamic. */
export const COUPLE_GAP_BASE = 22;
/** @deprecated Use COUPLE_GAP_BASE or getCoupleGapForFamily -- kept for callers expecting COUPLE_GAP */
export const COUPLE_GAP = COUPLE_GAP_BASE;
const COUPLE_GAP_PER_EXTRA_MARRIAGE = 10;
const MAX_COUPLE_GAP_EXTRA = 24;

/**
 * Counts full marriages (both parents) where handle is a parent -- used to widen couple gap
 * when someone has multiple spouses (e.g. multiple wives) so rows have room for hearts/labels.
 */
export function countMarriagesForPerson(handle: string, families: TreeFamily[]): number {
    return families.filter(
        f =>
            (f.fatherHandle === handle || f.motherHandle === handle) &&
            !!f.fatherHandle &&
            !!f.motherHandle,
    ).length;
}

export function getCoupleGapForFamily(family: TreeFamily, families: TreeFamily[]): number {
    const nF = family.fatherHandle ? countMarriagesForPerson(family.fatherHandle, families) : 1;
    const nM = family.motherHandle ? countMarriagesForPerson(family.motherHandle, families) : 1;
    const m = Math.max(nF, nM, 1);
    const extra = Math.min(MAX_COUPLE_GAP_EXTRA, Math.max(0, m - 1) * COUPLE_GAP_PER_EXTRA_MARRIAGE);
    return COUPLE_GAP_BASE + extra;
}

// === Internal subtree structure ===

interface Contour { left: number[]; right: number[] }

interface Subtree {
    family: TreeFamily;
    father?: TreeNode;
    mother?: TreeNode;
    patrilineal?: TreeNode;
    spouse?: TreeNode;
    children: ChildItem[];
    width: number;
    anchorX: number;
    contour: Contour;
    coupleGap: number;
}

interface ChildItem {
    subtree?: Subtree;
    leaf?: TreeNode;
    width: number;
    anchorX: number;
    contour: Contour;
}

function minSeparation(leftContour: Contour, rightContour: Contour, minGap: number = H_SPACE): number {
    const maxDepth = Math.min(leftContour.right.length, rightContour.left.length);
    let minSep = 0;
    for (let d = 0; d < maxDepth; d++) {
        const needed = leftContour.right[d] - rightContour.left[d] + minGap;
        minSep = Math.max(minSep, needed);
    }
    return Math.max(minSep, minGap);
}

function mergeContours(leftContour: Contour, rightContour: Contour, offset: number): Contour {
    const maxDepth = Math.max(leftContour.left.length, rightContour.left.length);
    const merged: Contour = { left: [], right: [] };
    for (let d = 0; d < maxDepth; d++) {
        const ll = d < leftContour.left.length ? leftContour.left[d] : Infinity;
        const rl = d < rightContour.left.length ? rightContour.left[d] + offset : Infinity;
        merged.left.push(Math.min(ll, rl));

        const lr = d < leftContour.right.length ? leftContour.right[d] : -Infinity;
        const rr = d < rightContour.right.length ? rightContour.right[d] + offset : -Infinity;
        merged.right.push(Math.max(lr, rr));
    }
    return merged;
}

// === Step 1: Build subtree recursively, compute widths bottom-up ===

function buildSubtree(
    family: TreeFamily,
    personMap: Map<string, TreeNode>,
    familyMap: Map<string, TreeFamily>,
    visited: Set<string>,
): Subtree | null {
    if (visited.has(family.handle)) return null;
    visited.add(family.handle);

    const familiesList = Array.from(familyMap.values());
    const cg = getCoupleGapForFamily(family, familiesList);

    const father = family.fatherHandle ? personMap.get(family.fatherHandle) : undefined;
    const mother = family.motherHandle ? personMap.get(family.motherHandle) : undefined;
    const patrilineal = father?.isPatrilineal ? father : mother?.isPatrilineal ? mother : (father || mother);
    const spouse = patrilineal === father ? mother : father;

    const children: ChildItem[] = [];

    for (const childHandle of family.children) {
        const child = personMap.get(childHandle);
        if (!child) continue;

        const childFamily = Array.from(familyMap.values()).find(f =>
            !visited.has(f.handle) &&
            (f.fatherHandle === childHandle || f.motherHandle === childHandle)
        );

        if (childFamily) {
            const sub = buildSubtree(childFamily, personMap, familyMap, visited);
            if (sub) {
                children.push({
                    subtree: sub, width: sub.width, anchorX: sub.anchorX,
                    contour: sub.contour,
                });
            } else {
                const leafContour: Contour = {
                    left: [-CARD_W / 2],
                    right: [CARD_W / 2],
                };
                children.push({ leaf: child, width: CARD_W, anchorX: CARD_W / 2, contour: leafContour });
            }
        } else {
            const leafContour: Contour = {
                left: [-CARD_W / 2],
                right: [CARD_W / 2],
            };
            children.push({ leaf: child, width: CARD_W, anchorX: CARD_W / 2, contour: leafContour });
        }
    }

    const hasCouple = patrilineal && spouse;
    const coupleWidth = hasCouple ? 2 * CARD_W + cg : CARD_W;
    const halfCard = CARD_W / 2;

    if (children.length === 0) {
        const coupleRight = hasCouple ? halfCard + cg + CARD_W : halfCard;
        const parentContour: Contour = {
            left: [-halfCard],
            right: [coupleRight],
        };
        return {
            family, father, mother, patrilineal, spouse, children,
            width: coupleWidth,
            anchorX: halfCard,
            contour: parentContour,
            coupleGap: cg,
        };
    }

    // Children align to couple midpoint (heart icon center) when there is a couple.
    // Relative to patrilineal center (anchor), this is a right shift.
    const groupShift = hasCouple ? (CARD_W + cg) / 2 : 0;

    if (children.length === 1) {
        const child = children[0];
        const childAnchor = child.anchorX;

        const childLeftFromAnchor = groupShift - childAnchor;
        const childRightFromAnchor = groupShift + (child.width - childAnchor);
        const coupleRight = hasCouple ? halfCard + cg + CARD_W : halfCard;
        const leftExtent = Math.max(halfCard, -childLeftFromAnchor);
        const rightExtent = Math.max(coupleRight, childRightFromAnchor);

        const combinedContour: Contour = {
            left: [Math.min(-halfCard, childLeftFromAnchor)],
            right: [Math.max(coupleRight, childRightFromAnchor)],
        };
        for (let d = 0; d < child.contour.left.length; d++) {
            combinedContour.left.push(child.contour.left[d] + groupShift);
            combinedContour.right.push(child.contour.right[d] + groupShift);
        }

        return {
            family, father, mother, patrilineal, spouse, children,
            width: leftExtent + rightExtent,
            anchorX: leftExtent,
            contour: combinedContour,
            coupleGap: cg,
        };
    }

    // N children: contour-based minimum separation
    const childOffsets: number[] = [0];
    let mergedChildContour: Contour = {
        left: [...children[0].contour.left],
        right: [...children[0].contour.right],
    };

    for (let i = 1; i < children.length; i++) {
        const sep = minSeparation(mergedChildContour, children[i].contour, INTRA_FAMILY_SIBLING_GAP);
        childOffsets.push(sep);
        mergedChildContour = mergeContours(mergedChildContour, children[i].contour, sep);
    }

    const firstAnchor = childOffsets[0];
    const lastAnchor = childOffsets[childOffsets.length - 1];
    const midpointOfAnchors = (firstAnchor + lastAnchor) / 2;

    let blockLeft = Infinity, blockRight = -Infinity;
    for (let i = 0; i < children.length; i++) {
        const childLeft = childOffsets[i] - children[i].anchorX;
        const childRight = childOffsets[i] + (children[i].width - children[i].anchorX);
        blockLeft = Math.min(blockLeft, childLeft);
        blockRight = Math.max(blockRight, childRight);
    }

    const childrenTotalWidth = blockRight - blockLeft;
    const childrenMidFromBlock = midpointOfAnchors - blockLeft;
    const childrenLeftFromAnchor = groupShift - childrenMidFromBlock;
    const childrenRightFromAnchor = groupShift + childrenTotalWidth - childrenMidFromBlock;
    const leftExtent = Math.max(halfCard, -childrenLeftFromAnchor);
    const coupleRight = hasCouple ? halfCard + cg + CARD_W : halfCard;
    const rightExtent = Math.max(coupleRight, childrenRightFromAnchor);

    const combinedContour: Contour = {
        left: [Math.min(-halfCard, childrenLeftFromAnchor)],
        right: [Math.max(coupleRight, childrenRightFromAnchor)],
    };
    for (let d = 0; d < mergedChildContour.left.length; d++) {
        combinedContour.left.push(mergedChildContour.left[d] - midpointOfAnchors + groupShift);
        combinedContour.right.push(mergedChildContour.right[d] - midpointOfAnchors + groupShift);
    }

    const subtreeResult: Subtree & { childOffsets?: number[]; blockLeft?: number } = {
        family, father, mother, patrilineal, spouse, children,
        width: leftExtent + rightExtent,
        anchorX: leftExtent,
        contour: combinedContour,
        coupleGap: cg,
    };
    (subtreeResult as any)._childOffsets = childOffsets;
    (subtreeResult as any)._blockLeft = blockLeft;

    return subtreeResult;
}

// === Step 2: Assign positions top-down ===

function assignPositions(
    subtree: Subtree,
    startX: number,
    generation: number,
    allNodes: PositionedNode[],
    placed: Set<string>,
) {
    const { patrilineal, spouse, children, anchorX } = subtree;
    const coupleGap = subtree.coupleGap ?? COUPLE_GAP_BASE;
    const y = generation * (CARD_H + V_SPACE);
    const patriCenterX = startX + anchorX;
    const hasCouple = !!(patrilineal && spouse);
    const parentGroupCenterX = patriCenterX + (hasCouple ? (CARD_W + coupleGap) / 2 : 0);

    if (patrilineal && !placed.has(patrilineal.handle)) {
        allNodes.push({ node: patrilineal, x: patriCenterX - CARD_W / 2, y, generation });
        placed.add(patrilineal.handle);
    }

    if (spouse && !placed.has(spouse.handle)) {
        allNodes.push({ node: spouse, x: patriCenterX + CARD_W / 2 + coupleGap, y, generation });
        placed.add(spouse.handle);
    }

    if (children.length === 0) return;

    if (children.length === 1) {
        const item = children[0];
        const cx = parentGroupCenterX - item.anchorX;
        if (item.subtree) {
            assignPositions(item.subtree, cx, generation + 1, allNodes, placed);
        } else if (item.leaf && !placed.has(item.leaf.handle)) {
            const childY = (generation + 1) * (CARD_H + V_SPACE);
            allNodes.push({ node: item.leaf, x: cx, y: childY, generation: generation + 1 });
            placed.add(item.leaf.handle);
        }
        return;
    }

    const storedOffsets = (subtree as any)._childOffsets as number[] | undefined;
    const storedBlockLeft = (subtree as any)._blockLeft as number | undefined;

    if (storedOffsets && storedBlockLeft !== undefined) {
        const firstAnchor = storedOffsets[0];
        const lastAnchor = storedOffsets[storedOffsets.length - 1];
        const midpoint = (firstAnchor + lastAnchor) / 2;

        for (let i = 0; i < children.length; i++) {
            const item = children[i];
            const childAnchorX = parentGroupCenterX - midpoint + storedOffsets[i];
            const childStartX = childAnchorX - item.anchorX;

            if (item.subtree) {
                assignPositions(item.subtree, childStartX, generation + 1, allNodes, placed);
            } else if (item.leaf && !placed.has(item.leaf.handle)) {
                const childY = (generation + 1) * (CARD_H + V_SPACE);
                allNodes.push({ node: item.leaf, x: childStartX, y: childY, generation: generation + 1 });
                placed.add(item.leaf.handle);
            }
        }
    } else {
        const childAnchors: number[] = [];
        let blockOffset = 0;
        for (const item of children) {
            childAnchors.push(blockOffset + item.anchorX);
            blockOffset += item.width + INTRA_FAMILY_SIBLING_GAP;
        }
        const firstAnchor = childAnchors[0];
        const lastAnchor = childAnchors[childAnchors.length - 1];
        const midpoint = (firstAnchor + lastAnchor) / 2;

        const blockStartX = parentGroupCenterX - midpoint;

        let cx = blockStartX;
        for (const item of children) {
            if (item.subtree) {
                assignPositions(item.subtree, cx, generation + 1, allNodes, placed);
            } else if (item.leaf && !placed.has(item.leaf.handle)) {
                const childY = (generation + 1) * (CARD_H + V_SPACE);
                allNodes.push({ node: item.leaf, x: cx, y: childY, generation: generation + 1 });
                placed.add(item.leaf.handle);
            }
            cx += item.width + INTRA_FAMILY_SIBLING_GAP;
        }
    }
}

/**
 * Force each father+mother pair onto one row, patrilineal left / spouse right, with per-family gap.
 * Preserves the couple's horizontal center so trees don't jump sideways.
 */
function snapDirectCouples(
    allNodes: PositionedNode[],
    families: TreeFamily[],
    gens: Map<string, number>,
    personMap: Map<string, TreeNode>,
): void {
    const nodeMap = new Map(allNodes.map((n) => [n.node.handle, n]));

    for (const fam of families) {
        if (!fam.fatherHandle || !fam.motherHandle) continue;
        const fn = nodeMap.get(fam.fatherHandle);
        const mn = nodeMap.get(fam.motherHandle);
        if (!fn || !mn) continue;

        const father = personMap.get(fam.fatherHandle);
        const mother = personMap.get(fam.motherHandle);
        if (!father || !mother) continue;

        const patrilineal = father.isPatrilineal ? father : mother.isPatrilineal ? mother : father;
        const patriNode = fn.node.handle === patrilineal.handle ? fn : mn;
        const spouseNode = fn.node.handle === patrilineal.handle ? mn : fn;

        const g = gens.get(fam.fatherHandle) ?? gens.get(fam.motherHandle) ?? 0;
        const y = g * (CARD_H + V_SPACE);
        fn.y = y;
        mn.y = y;
        fn.generation = g;
        mn.generation = g;

        const gap = getCoupleGapForFamily(fam, families);
        const coupleCenterX = (fn.x + CARD_W / 2 + mn.x + CARD_W / 2) / 2;
        const patriCenterX = coupleCenterX - (CARD_W + gap) / 2;
        patriNode.x = patriCenterX - CARD_W / 2;
        spouseNode.x = patriCenterX + CARD_W / 2 + gap;
    }
}

function hasSpouseOnSameRow(
    handle: string,
    inRow: Map<string, PositionedNode>,
    families: TreeFamily[],
): boolean {
    for (const fam of families) {
        if (!fam.fatherHandle || !fam.motherHandle) continue;
        if (fam.fatherHandle !== handle && fam.motherHandle !== handle) continue;
        const other = fam.fatherHandle === handle ? fam.motherHandle : fam.fatherHandle;
        if (inRow.has(other)) return true;
    }
    return false;
}

/**
 * Prevent card overlaps on same-row: left-to-right sweep with tiny gap.
 * Does NOT impose FAMILY_GROUP_GAP -- the contour layout already provides natural spacing.
 * Shifts entire descendant subtrees to preserve connection geometry.
 */
const MIN_NO_OVERLAP_GAP = 12;

function resolveGenerationOverlaps(allNodes: PositionedNode[], families: TreeFamily[]): void {
    const nodeMap = new Map(allNodes.map(n => [n.node.handle, n]));

    function shiftSubtreeFromSeeds(seeds: string[], delta: number) {
        if (delta === 0) return;
        const visited = new Set<string>();
        function go(h: string) {
            if (visited.has(h)) return;
            visited.add(h);
            const pn = nodeMap.get(h);
            if (pn) pn.x += delta;
            for (const f of families) {
                if (f.fatherHandle === h || f.motherHandle === h) {
                    for (const ch of f.children) go(ch);
                }
            }
        }
        for (const s of seeds) go(s);
    }

    const byGen = new Map<number, PositionedNode[]>();
    for (const n of allNodes) {
        const g = n.generation;
        if (!byGen.has(g)) byGen.set(g, []);
        byGen.get(g)!.push(n);
    }

    const sortedGens = Array.from(byGen.entries()).sort((a, b) => a[0] - b[0]);

    for (const [, row] of sortedGens) {
        const inRow = new Map(row.map(n => [n.node.handle, n]));

        const ufParent = new Map<string, string>();
        function find(a: string): string {
            if (!ufParent.has(a)) ufParent.set(a, a);
            if (ufParent.get(a) !== a) ufParent.set(a, find(ufParent.get(a)!));
            return ufParent.get(a)!;
        }
        function union(a: string, b: string) {
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb) ufParent.set(ra, rb);
        }

        for (const fam of families) {
            if (!fam.fatherHandle || !fam.motherHandle) continue;
            const fn = inRow.get(fam.fatherHandle);
            const mn = inRow.get(fam.motherHandle);
            if (!fn || !mn) continue;
            if (fn.generation !== mn.generation) continue;
            union(fam.fatherHandle, fam.motherHandle);
        }

        for (const fam of families) {
            const sibs = fam.children.filter((ch) => inRow.has(ch));
            const packTogether = sibs.filter((ch) => !hasSpouseOnSameRow(ch, inRow, families));
            if (packTogether.length < 2) continue;
            for (let i = 1; i < packTogether.length; i++) {
                union(packTogether[0], packTogether[i]);
            }
        }

        const clusters = new Map<string, PositionedNode[]>();
        for (const n of row) {
            const r = find(n.node.handle);
            if (!clusters.has(r)) clusters.set(r, []);
            clusters.get(r)!.push(n);
        }

        const sorted = Array.from(clusters.values()).sort(
            (a, b) => Math.min(...a.map(n => n.x)) - Math.min(...b.map(n => n.x)),
        );

        function gapForPair(left: PositionedNode[], right: PositionedNode[]): number {
            for (const fam of families) {
                if (!fam.fatherHandle || !fam.motherHandle) continue;
                const lSet = new Set(left.map(n => n.node.handle));
                const rSet = new Set(right.map(n => n.node.handle));
                if (
                    (lSet.has(fam.fatherHandle) && rSet.has(fam.motherHandle)) ||
                    (lSet.has(fam.motherHandle) && rSet.has(fam.fatherHandle))
                ) {
                    return getCoupleGapForFamily(fam, families);
                }
            }
            return MIN_NO_OVERLAP_GAP;
        }

        let prevCluster: PositionedNode[] | null = null;
        let prevRight = -Infinity;
        for (const cluster of sorted) {
            const minX = Math.min(...cluster.map(n => n.x));
            let delta = 0;
            if (prevRight !== -Infinity && prevCluster) {
                const gap = gapForPair(prevCluster, cluster);
                const minLeftNeeded = prevRight + gap;
                delta = Math.max(0, minLeftNeeded - minX);
            }
            if (delta > 0) {
                shiftSubtreeFromSeeds(
                    cluster.map(n => n.node.handle),
                    delta,
                );
            }
            prevRight = Math.max(
                ...cluster.map(n => (nodeMap.get(n.node.handle)?.x ?? n.x) + CARD_W),
            );
            prevCluster = cluster;
        }
    }
}

/**
 * After resolveGenerationOverlaps, child clusters may no longer sit under the couple midpoint
 * (heart icon). Re-center each family's descendant subtree on that midpoint without creating
 * new overlaps on any generation row.
 */
function collectDescendantsFromSeeds(seeds: string[], families: TreeFamily[]): Set<string> {
    const result = new Set<string>();
    const stack = [...seeds];
    while (stack.length > 0) {
        const h = stack.pop()!;
        if (result.has(h)) continue;
        result.add(h);
        for (const fam of families) {
            if (fam.fatherHandle === h || fam.motherHandle === h) {
                for (const ch of fam.children) stack.push(ch);
            }
        }
    }
    return result;
}

function realignChildrenToCoupleHeart(allNodes: PositionedNode[], families: TreeFamily[]): void {
    const nodeMap = new Map(allNodes.map((n) => [n.node.handle, n]));
    const rows = new Map<number, PositionedNode[]>();
    for (const n of allNodes) {
        if (!rows.has(n.generation)) rows.set(n.generation, []);
        rows.get(n.generation)!.push(n);
    }

    const orderedFamilies = [...families].sort((a, b) => {
        const ag = Math.min(
            a.fatherHandle ? nodeMap.get(a.fatherHandle)?.generation ?? 999 : 999,
            a.motherHandle ? nodeMap.get(a.motherHandle)?.generation ?? 999 : 999,
        );
        const bg = Math.min(
            b.fatherHandle ? nodeMap.get(b.fatherHandle)?.generation ?? 999 : 999,
            b.motherHandle ? nodeMap.get(b.motherHandle)?.generation ?? 999 : 999,
        );
        return ag - bg;
    });

    for (const fam of orderedFamilies) {
        const father = fam.fatherHandle ? nodeMap.get(fam.fatherHandle) : undefined;
        const mother = fam.motherHandle ? nodeMap.get(fam.motherHandle) : undefined;
        const children = fam.children
            .map((h) => nodeMap.get(h))
            .filter((n): n is PositionedNode => !!n);
        if (children.length === 0) continue;

        let parentHeartX: number;
        if (father && mother) {
            parentHeartX = (father.x + CARD_W / 2 + mother.x + CARD_W / 2) / 2;
        } else if (father) {
            parentHeartX = father.x + CARD_W / 2;
        } else if (mother) {
            parentHeartX = mother.x + CARD_W / 2;
        } else {
            continue;
        }

        const centers = children.map((c) => c.x + CARD_W / 2).sort((a, b) => a - b);
        const childrenCenterX =
            centers.length === 1
                ? centers[0]
                : (centers[0] + centers[centers.length - 1]) / 2;

        const desiredDelta = parentHeartX - childrenCenterX;
        if (Math.abs(desiredDelta) < 0.5) continue;

        const moving = collectDescendantsFromSeeds(
            children.map((c) => c.node.handle),
            families,
        );

        let minAllowedDelta = -Infinity;
        let maxAllowedDelta = Infinity;
        for (const [, row] of rows) {
            const movingRow = row.filter((n) => moving.has(n.node.handle));
            if (movingRow.length === 0) continue;
            const movingMinX = Math.min(...movingRow.map((n) => n.x));
            const movingMaxRight = Math.max(...movingRow.map((n) => n.x + CARD_W));
            const staticRow = row.filter((n) => !moving.has(n.node.handle));
            for (const other of staticRow) {
                const otherLeft = other.x;
                const otherRight = other.x + CARD_W;
                if (otherRight <= movingMinX) {
                    minAllowedDelta = Math.max(
                        minAllowedDelta,
                        otherRight + MIN_NO_OVERLAP_GAP - movingMinX,
                    );
                } else if (otherLeft >= movingMaxRight) {
                    maxAllowedDelta = Math.min(
                        maxAllowedDelta,
                        otherLeft - MIN_NO_OVERLAP_GAP - movingMaxRight,
                    );
                }
                // If intervals intersect, min/max stay infinite; second resolveGenerationOverlaps fixes overlaps.
            }
        }

        if (maxAllowedDelta < minAllowedDelta) continue;
        const delta = Math.max(minAllowedDelta, Math.min(maxAllowedDelta, desiredDelta));
        if (Math.abs(delta) < 0.5) continue;

        for (const n of allNodes) {
            if (moving.has(n.node.handle)) n.x += delta;
        }
    }
}

/**
 * Keep family->children relationships consistent with each child's `parentFamilies`.
 * If a child declares parent families, only those families are allowed to render that child.
 * This prevents a child from appearing under the wrong couple when stale family rows exist.
 */
function normalizeFamiliesByParentLinks(people: TreeNode[], families: TreeFamily[]): TreeFamily[] {
    const personMap = new Map(people.map((p) => [p.handle, p]));
    const familyMap = new Map(families.map((f) => [f.handle, f]));

    const familiesContainingChild = new Map<string, string[]>();
    for (const fam of families) {
        for (const ch of fam.children) {
            if (!familiesContainingChild.has(ch)) familiesContainingChild.set(ch, []);
            familiesContainingChild.get(ch)!.push(fam.handle);
        }
    }

    const canonicalFamilyByChild = new Map<string, string>();
    for (const person of people) {
        const declared = (person.parentFamilies ?? []).filter((h) => familyMap.has(h));
        const fallback = familiesContainingChild.get(person.handle) ?? [];
        const candidates = declared.length > 0 ? declared : fallback;
        if (candidates.length === 0) continue;

        const ranked = [...new Set(candidates)]
            .map((h) => {
                const fam = familyMap.get(h)!;
                const parentsCount = (fam.fatherHandle ? 1 : 0) + (fam.motherHandle ? 1 : 0);
                const alreadyContains = fam.children.includes(person.handle) ? 1 : 0;
                return { h, score: parentsCount * 10 + alreadyContains };
            })
            .sort((a, b) => (b.score - a.score) || a.h.localeCompare(b.h));

        canonicalFamilyByChild.set(person.handle, ranked[0].h);
    }

    return families.map((fam) => {
        const seen = new Set<string>();
        const children = fam.children.filter((ch) => {
            if (seen.has(ch)) return false;
            seen.add(ch);
            const child = personMap.get(ch);
            if (!child) return false;
            const canonical = canonicalFamilyByChild.get(ch);
            return canonical ? canonical === fam.handle : true;
        });

        // If canonical mapping points to this family but stale `children` missed it, render it here.
        for (const [childHandle, canonicalFamily] of canonicalFamilyByChild.entries()) {
            if (canonicalFamily !== fam.handle) continue;
            if (!children.includes(childHandle)) children.push(childHandle);
        }

        return { ...fam, children };
    });
}

// === Main layout ===

export function computeLayout(people: TreeNode[], families: TreeFamily[]): LayoutResult {
    const normalizedFamilies = normalizeFamiliesByParentLinks(people, families);
    const personMap = new Map(people.map(p => [p.handle, p]));
    const familyMap = new Map(normalizedFamilies.map(f => [f.handle, f]));

    const gens = assignGenerations(people, normalizedFamilies);

    const childOfAnyFamily = new Set<string>();
    for (const f of normalizedFamilies) {
        for (const ch of f.children) childOfAnyFamily.add(ch);
    }
    const rootFamilies = normalizedFamilies.filter((f) => {
        const hasFather = !!f.fatherHandle;
        const hasMother = !!f.motherHandle;
        const fatherIsRoot = !hasFather || !childOfAnyFamily.has(f.fatherHandle!);
        const motherIsRoot = !hasMother || !childOfAnyFamily.has(f.motherHandle!);
        return fatherIsRoot && motherIsRoot;
    });

    const allNodes: PositionedNode[] = [];
    const visited = new Set<string>();
    const placed = new Set<string>();
    let cursorX = 0;

    for (const fam of rootFamilies) {
        const subtree = buildSubtree(fam, personMap, familyMap, visited);
        if (!subtree) continue;
        const fh = fam.fatherHandle ? personMap.get(fam.fatherHandle) : undefined;
        const mh = fam.motherHandle ? personMap.get(fam.motherHandle) : undefined;
        const patrilineal = fh?.isPatrilineal ? fh : mh?.isPatrilineal ? mh : fh ?? mh;
        const baseGen = patrilineal ? (gens.get(patrilineal.handle) ?? 0) : 0;
        assignPositions(subtree, cursorX, baseGen, allNodes, placed);
        cursorX += subtree.width + FAMILY_GROUP_GAP;
    }

    for (const p of people) {
        if (!placed.has(p.handle)) {
            const gen = gens.get(p.handle) ?? 0;
            allNodes.push({
                node: p,
                x: cursorX,
                y: gen * (CARD_H + V_SPACE),
                generation: gen,
            });
            placed.add(p.handle);
            cursorX += CARD_W + FAMILY_GROUP_GAP;
        }
    }

    // Normalize: shift all nodes so min X = 0
    let minX = Infinity;
    for (const n of allNodes) {
        minX = Math.min(minX, n.x);
    }
    if (minX !== 0 && minX !== Infinity) {
        for (const n of allNodes) {
            n.x -= minX;
        }
    }

    for (const n of allNodes) {
        const g = gens.get(n.node.handle);
        if (g !== undefined) {
            n.generation = g;
            n.y = g * (CARD_H + V_SPACE);
        }
    }

    snapDirectCouples(allNodes, normalizedFamilies, gens, personMap);
    resolveGenerationOverlaps(allNodes, normalizedFamilies);
    realignChildrenToCoupleHeart(allNodes, normalizedFamilies);
    // Realign can reintroduce row overlaps; sweep again, then snap couples to canonical spacing.
    resolveGenerationOverlaps(allNodes, normalizedFamilies);
    snapDirectCouples(allNodes, normalizedFamilies, gens, personMap);

    // Compute strictly orthogonal connections
    const nodeMap = new Map(allNodes.map(n => [n.node.handle, n]));
    const connections: Connection[] = [];
    const couples: PositionedCouple[] = [];

    for (const fam of normalizedFamilies) {
        const fatherNode = fam.fatherHandle ? nodeMap.get(fam.fatherHandle) : undefined;
        const motherNode = fam.motherHandle ? nodeMap.get(fam.motherHandle) : undefined;
        if (!fatherNode && !motherNode) continue;

        const patriNode = (fatherNode?.node.isPatrilineal ? fatherNode : motherNode) ?? fatherNode;

        // Connection lines come from couple midpoint (visual center between parents)
        const parentGroupCenterX =
            fatherNode && motherNode
                ? (fatherNode.x + CARD_W / 2 + motherNode.x + CARD_W / 2) / 2
                : patriNode
                  ? patriNode.x + CARD_W / 2
                  : 0;

        if (fatherNode && motherNode) {
            const left = fatherNode.x < motherNode.x ? fatherNode : motherNode;
            const right = fatherNode.x < motherNode.x ? motherNode : fatherNode;
            connections.push({
                fromX: left.x + CARD_W, fromY: left.y + CARD_H / 2,
                toX: right.x, toY: right.y + CARD_H / 2,
                type: 'couple',
                familyHandle: fam.handle,
            });
            couples.push({
                familyHandle: fam.handle,
                fatherPos: fatherNode, motherPos: motherNode,
                midX: (left.x + CARD_W + right.x) / 2,
                y: left.y,
            });
        }

        if (patriNode && fam.children.length > 0) {
            const parentCX = parentGroupCenterX;
            // Bottom of parent row (both spouses share the same y after snap)
            const parentBottomY =
                fatherNode && motherNode
                    ? Math.max(fatherNode.y, motherNode.y) + CARD_H
                    : patriNode.y + CARD_H;

            const placedChildren = fam.children
                .map(ch => nodeMap.get(ch))
                .filter((n): n is PositionedNode => !!n);
            if (placedChildren.length === 0) continue;

            const childTopY = placedChildren[0].y;
            const busY = parentBottomY + (childTopY - parentBottomY) * 0.5;

            if (placedChildren.length === 1) {
                const childCX = placedChildren[0].x + CARD_W / 2;

                if (Math.abs(childCX - parentCX) < 1) {
                    connections.push({
                        fromX: parentCX, fromY: parentBottomY,
                        toX: parentCX, toY: childTopY,
                        type: 'parent-child',
                        familyHandle: fam.handle,
                    });
                } else {
                    connections.push({
                        fromX: parentCX, fromY: parentBottomY,
                        toX: parentCX, toY: busY,
                        type: 'parent-child',
                        familyHandle: fam.handle,
                    });
                    connections.push({
                        fromX: parentCX, fromY: busY,
                        toX: childCX, toY: busY,
                        type: 'parent-child',
                        familyHandle: fam.handle,
                    });
                    connections.push({
                        fromX: childCX, fromY: busY,
                        toX: childCX, toY: childTopY,
                        type: 'parent-child',
                        familyHandle: fam.handle,
                    });
                }
            } else {
                connections.push({
                    fromX: parentCX, fromY: parentBottomY,
                    toX: parentCX, toY: busY,
                    type: 'parent-child',
                    familyHandle: fam.handle,
                });

                const childCenters = placedChildren
                    .map(c => c.x + CARD_W / 2)
                    .sort((a, b) => a - b);
                const busLeft = Math.min(parentCX, childCenters[0]);
                const busRight = Math.max(parentCX, childCenters[childCenters.length - 1]);

                connections.push({
                    fromX: busLeft, fromY: busY,
                    toX: busRight, toY: busY,
                    type: 'parent-child',
                    familyHandle: fam.handle,
                });

                for (const child of placedChildren) {
                    const cx = child.x + CARD_W / 2;
                    connections.push({
                        fromX: cx, fromY: busY,
                        toX: cx, toY: childTopY,
                        type: 'parent-child',
                        familyHandle: fam.handle,
                    });
                }
            }
        }
    }

    let maxX = 0, maxY = 0;
    for (const n of allNodes) {
        maxX = Math.max(maxX, n.x + CARD_W);
        maxY = Math.max(maxY, n.y + CARD_H);
    }

    return {
        nodes: allNodes,
        couples,
        connections,
        width: maxX + FAMILY_GROUP_GAP,
        height: maxY + V_SPACE / 2,
        generations: gens.size === 0 ? 0 : Math.max(...Array.from(gens.values())) + 1,
    };
}

// === Generation assignment ===

export function computeTreeGenerations(people: TreeNode[], families: TreeFamily[]): Map<string, number> {
    const childOf = new Set<string>();
    for (const f of families) {
        for (const ch of f.children) childOf.add(ch);
    }

    const gens = new Map<string, number>();

    for (const p of people) {
        if (!childOf.has(p.handle)) {
            gens.set(p.handle, 0);
        }
    }

    for (let iter = 0; iter < 64; iter++) {
        let changed = false;

        for (const fam of families) {
            const fh = fam.fatherHandle;
            const mh = fam.motherHandle;
            if (fh && mh) {
                const gf = gens.get(fh);
                const gm = gens.get(mh);
                const a = gf !== undefined ? gf : -1;
                const b = gm !== undefined ? gm : -1;
                if (a >= 0 || b >= 0) {
                    const s = Math.max(a, b);
                    if (gens.get(fh) !== s) {
                        gens.set(fh, s);
                        changed = true;
                    }
                    if (gens.get(mh) !== s) {
                        gens.set(mh, s);
                        changed = true;
                    }
                }
            }
        }

        for (const fam of families) {
            const fh = fam.fatherHandle;
            const mh = fam.motherHandle;
            const gff = fh ? gens.get(fh) : undefined;
            const gmm = mh ? gens.get(mh) : undefined;

            let base: number | undefined;
            if (fh && mh) {
                if (gff !== undefined && gmm !== undefined) base = Math.max(gff, gmm);
                else if (gff !== undefined) base = gff;
                else if (gmm !== undefined) base = gmm;
            } else if (fh) {
                base = gff;
            } else if (mh) {
                base = gmm;
            }

            if (base === undefined) continue;

            const ng = base + 1;
            for (const ch of fam.children) {
                const cur = gens.get(ch);
                if (cur === undefined || ng > cur) {
                    gens.set(ch, ng);
                    changed = true;
                }
            }
        }

        if (!changed) break;
    }

    for (const p of people) {
        if (!gens.has(p.handle)) {
            gens.set(p.handle, 0);
        }
    }

    return gens;
}

function assignGenerations(people: TreeNode[], families: TreeFamily[]): Map<string, number> {
    return computeTreeGenerations(people, families);
}

// === Filter functions ===

export function filterAncestors(handle: string, people: TreeNode[], families: TreeFamily[]) {
    const result = new Set<string>();
    const familyMap = new Map(families.map(f => [f.handle, f]));
    const personMap = new Map(people.map(p => [p.handle, p]));

    function walk(h: string) {
        if (result.has(h)) return;
        result.add(h);
        const person = personMap.get(h);
        if (!person) return;
        for (const pfId of person.parentFamilies) {
            const fam = familyMap.get(pfId);
            if (fam) {
                if (fam.fatherHandle) walk(fam.fatherHandle);
                if (fam.motherHandle) walk(fam.motherHandle);
            }
        }
    }
    walk(handle);

    return {
        filteredPeople: people.filter(p => result.has(p.handle)),
        filteredFamilies: families.filter(f =>
            (f.fatherHandle && result.has(f.fatherHandle)) || (f.motherHandle && result.has(f.motherHandle))
        ),
    };
}

export function filterDescendants(handle: string, people: TreeNode[], families: TreeFamily[]) {
    const result = new Set<string>();
    const familyMap = new Map(families.map(f => [f.handle, f]));
    const personMap = new Map(people.map(p => [p.handle, p]));
    const includedFamilies = new Set<string>();

    function walk(h: string) {
        if (result.has(h)) return;
        result.add(h);
        const person = personMap.get(h);
        if (!person) return;
        for (const fId of person.families) {
            const fam = familyMap.get(fId);
            if (fam) {
                includedFamilies.add(fam.handle);
                if (fam.fatherHandle) result.add(fam.fatherHandle);
                if (fam.motherHandle) result.add(fam.motherHandle);
                for (const ch of fam.children) walk(ch);
            }
        }
    }
    walk(handle);

    return {
        filteredPeople: people.filter(p => result.has(p.handle)),
        filteredFamilies: families.filter(f => includedFamilies.has(f.handle)),
    };
}
