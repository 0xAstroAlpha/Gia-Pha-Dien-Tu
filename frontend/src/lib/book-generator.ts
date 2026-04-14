/**
 * Book Generator — Transforms genealogy tree data into a structured book format.
 *
 * Produces chapters by generation, with each patrilineal person getting
 * a full entry showing parents, spouse, and children.
 */

import type { TreeNode, TreeFamily } from './tree-layout';

// ═══ Book Data Types ═══

export interface BookPerson {
    handle: string;
    name: string;
    gender: number;
    birthYear?: number;
    deathYear?: number;
    isLiving: boolean;
    isPatrilineal: boolean;
    generation: number;
    fatherName?: string;
    motherName?: string;
    spouseName?: string;
    spouseYears?: string;
    spouseNote?: string; // "(Ngoại tộc)"
    children: { name: string; years: string; note?: string }[];
    childIndex?: number; // thứ tự con trong gia đình (1, 2, 3...)
}

export interface BookChapter {
    generation: number;
    title: string;         // "ĐỜI THỨ I — THỦY TỔ"
    romanNumeral: string;  // "I", "II", etc.
    members: BookPerson[];
}

export interface BookData {
    familyName: string;
    exportDate: string;
    totalGenerations: number;
    totalMembers: number;
    totalPatrilineal: number;
    chapters: BookChapter[];
    nameIndex: { name: string; generation: number; isPatrilineal: boolean }[];
}

// ═══ Helpers ═══

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

const GEN_NAMES: Record<number, string> = {
    0: 'THỦY TỔ',
};

function romanNumeral(n: number): string {
    return ROMAN[n] || `${n + 1}`;
}

function genTitle(gen: number): string {
    const roman = romanNumeral(gen);
    const name = GEN_NAMES[gen] || '';
    return name ? `ĐỜI THỨ ${roman} — ${name}` : `ĐỜI THỨ ${roman}`;
}

function formatYears(birth?: number, death?: number, isLiving?: boolean): string {
    if (!birth) return '—';
    if (death) return `${birth} – ${death}`;
    if (isLiving) return `${birth} – nay`;
    return `${birth}`;
}

// ═══ Main Generator ═══

export function generateBookData(
    people: TreeNode[],
    families: TreeFamily[],
    familyName: string = 'Đỗ Văn',
): BookData {
    const personMap = new Map(people.map(p => [p.handle, p]));
    const familyMap = new Map(families.map(f => [f.handle, f]));
    const ownFamiliesByParent = new Map<string, TreeFamily[]>();
    for (const fam of families) {
        if (fam.fatherHandle) {
            const arr = ownFamiliesByParent.get(fam.fatherHandle) ?? [];
            arr.push(fam);
            ownFamiliesByParent.set(fam.fatherHandle, arr);
        }
        if (fam.motherHandle) {
            const arr = ownFamiliesByParent.get(fam.motherHandle) ?? [];
            arr.push(fam);
            ownFamiliesByParent.set(fam.motherHandle, arr);
        }
    }

    // ── Step 1: Assign generations via BFS from roots ──
    const generations = new Map<string, number>();
    const childOfFamily = new Set<string>();
    const parentFamiliesByChild = new Map<string, TreeFamily[]>();
    for (const f of families) {
        for (const ch of f.children) {
            childOfFamily.add(ch);
            const arr = parentFamiliesByChild.get(ch) ?? [];
            arr.push(f);
            parentFamiliesByChild.set(ch, arr);
        }
    }

    // Find root persons (not a child of any family)
    const roots = people.filter(p => !childOfFamily.has(p.handle));

    function setGen(handle: string, gen: number) {
        const current = generations.get(handle);
        if (current !== undefined && current >= gen) return;
        generations.set(handle, gen);
        const person = personMap.get(handle);
        if (!person) return;
        for (const fam of families) {
            if (fam.fatherHandle !== handle && fam.motherHandle !== handle) continue;
            // Spouse gets same generation
            if (fam.fatherHandle && fam.fatherHandle !== handle) {
                const spouseCurrent = generations.get(fam.fatherHandle);
                if (spouseCurrent === undefined || spouseCurrent > gen) generations.set(fam.fatherHandle, gen);
            }
            if (fam.motherHandle && fam.motherHandle !== handle) {
                const spouseCurrent = generations.get(fam.motherHandle);
                if (spouseCurrent === undefined || spouseCurrent > gen) generations.set(fam.motherHandle, gen);
            }
            // Children get gen+1
            for (const ch of fam.children) setGen(ch, gen + 1);
        }
    }

    for (const r of roots) {
        setGen(r.handle, 0);
    }
    // Catch any unassigned
    for (const p of people) {
        if (!generations.has(p.handle)) generations.set(p.handle, 0);
    }

    // Normalize from parent links in families: each child should be max(parentGen)+1.
    // This avoids stale generations when person.families / parent_families arrays drift.
    let changed = true;
    while (changed) {
        changed = false;
        for (const p of people) {
            const parentFams = parentFamiliesByChild.get(p.handle) ?? [];
            if (parentFams.length === 0) continue;
            let expectedGen = Number.NEGATIVE_INFINITY;
            for (const fam of parentFams) {
                const parentGens: number[] = [];
                if (fam.fatherHandle && generations.has(fam.fatherHandle)) parentGens.push(generations.get(fam.fatherHandle)!);
                if (fam.motherHandle && generations.has(fam.motherHandle)) parentGens.push(generations.get(fam.motherHandle)!);
                if (parentGens.length === 0) continue;
                const famExpected = Math.max(...parentGens) + 1;
                if (famExpected > expectedGen) expectedGen = famExpected;
            }
            if (!Number.isFinite(expectedGen)) continue;
            const current = generations.get(p.handle) ?? 0;
            if (current !== expectedGen) {
                generations.set(p.handle, expectedGen);
                changed = true;
            }
        }
    }

    // ── Step 2: Build person entries ──
    const bookPersons: BookPerson[] = [];

    // Group by generation
    const genGroups = new Map<number, TreeNode[]>();
    for (const p of people) {
        const gen = generations.get(p.handle) ?? 0;
        if (!genGroups.has(gen)) genGroups.set(gen, []);
        genGroups.get(gen)!.push(p);
    }

    // For each patrilineal person, build a BookPerson entry
    for (const p of people) {
        if (!p.isPatrilineal) continue;

        const gen = generations.get(p.handle) ?? 0;

        // Find parent info
        let fatherName: string | undefined;
        let motherName: string | undefined;
        for (const pfId of p.parentFamilies) {
            const pf = familyMap.get(pfId);
            if (pf) {
                if (pf.fatherHandle) {
                    const father = personMap.get(pf.fatherHandle);
                    if (father) fatherName = father.displayName;
                }
                if (pf.motherHandle) {
                    const mother = personMap.get(pf.motherHandle);
                    if (mother) motherName = mother.displayName;
                }
            }
        }

        // Find spouse and children from families where this person is a parent.
        // Prefer authoritative families graph; fallback to person.families if needed.
        let spouseName: string | undefined;
        let spouseYears: string | undefined;
        let spouseNote: string | undefined;
        const children: BookPerson['children'] = [];
        const seenChildren = new Set<string>();

        const ownFamilies = ownFamiliesByParent.get(p.handle) ?? [];
        const sourceFamilies = ownFamilies.length > 0
            ? ownFamilies
            : p.families.map((famId) => familyMap.get(famId)).filter((fam): fam is TreeFamily => !!fam);

        for (const fam of sourceFamilies) {

            // Determine spouse
            const spouseHandle = fam.fatherHandle === p.handle ? fam.motherHandle : fam.fatherHandle;
            if (spouseHandle) {
                const spouse = personMap.get(spouseHandle);
                if (spouse) {
                    spouseName = spouse.displayName;
                    spouseYears = formatYears(spouse.birthYear, spouse.deathYear, spouse.isLiving);
                    if (!spouse.isPatrilineal) spouseNote = 'Ngoại tộc';
                }
            }

            // Children
            for (let i = 0; i < fam.children.length; i++) {
                const childHandle = fam.children[i];
                if (seenChildren.has(childHandle)) continue;
                seenChildren.add(childHandle);
                const child = personMap.get(childHandle);
                if (child) {
                    children.push({
                        name: child.displayName,
                        years: formatYears(child.birthYear, child.deathYear, child.isLiving),
                        note: !child.isPatrilineal ? 'Ngoại tộc' : undefined,
                    });
                }
            }
        }

        // Find child index within parent family
        let childIndex: number | undefined;
        const parentFamilies = parentFamiliesByChild.get(p.handle) ?? [];
        if (parentFamilies.length > 0) {
            const pf = parentFamilies[0];
            const idx = pf.children.indexOf(p.handle);
            if (idx >= 0) childIndex = idx + 1;
        }

        bookPersons.push({
            handle: p.handle,
            name: p.displayName,
            gender: p.gender,
            birthYear: p.birthYear,
            deathYear: p.deathYear,
            isLiving: p.isLiving,
            isPatrilineal: p.isPatrilineal,
            generation: gen,
            fatherName,
            motherName,
            spouseName,
            spouseYears,
            spouseNote,
            children,
            childIndex,
        });
    }

    // ── Step 3: Build chapters ──
    const maxGen = Math.max(...Array.from(generations.values()));
    const chapters: BookChapter[] = [];

    for (let g = 0; g <= maxGen; g++) {
        const members = bookPersons
            .filter(bp => bp.generation === g)
            .sort((a, b) => (a.childIndex ?? 99) - (b.childIndex ?? 99));

        if (members.length === 0) continue;

        chapters.push({
            generation: g,
            title: genTitle(g),
            romanNumeral: romanNumeral(g),
            members,
        });
    }

    // ── Step 4: Build name index ──
    const nameIndex = people
        .map(p => ({
            name: p.displayName,
            generation: generations.get(p.handle) ?? 0,
            isPatrilineal: p.isPatrilineal,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    return {
        familyName,
        exportDate: new Date().toLocaleDateString('vi-VN', {
            year: 'numeric', month: 'long', day: 'numeric',
        }),
        totalGenerations: maxGen + 1,
        totalMembers: people.length,
        totalPatrilineal: people.filter(p => p.isPatrilineal).length,
        chapters,
        nameIndex,
    };
}
