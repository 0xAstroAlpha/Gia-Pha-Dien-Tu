/**
 * Effective "đời thứ" for display: recursive max(parent effective generation) + 1,
 * falling back to stored `people.generation` when there are no linked parents.
 * Fixes cases where a parent's row still has a stale `generation` but their own
 * parents define them as đời 2, so children become đời 3.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

function parseGeneration(raw: unknown): number | undefined {
    if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
    if (typeof raw === 'string' && raw.trim() !== '') {
        const n = Number(raw);
        if (!Number.isNaN(n)) return n;
    }
    return undefined;
}

type FamRow = {
    father_handle: string | null;
    mother_handle: string | null;
    children: string[] | null;
};

async function resolveBirthParents(
    supabase: SupabaseClient,
    personHandle: string,
    parentFamilies: string[],
): Promise<{ father: string | null; mother: string | null }> {
    const { data: birthFromChild } = await supabase
        .from('families')
        .select('handle, father_handle, mother_handle, children')
        .contains('children', [personHandle]);

    let rows = (birthFromChild ?? []) as FamRow[];
    if (rows.length === 0 && parentFamilies.length > 0) {
        const { data: byHandle } = await supabase
            .from('families')
            .select('handle, father_handle, mother_handle, children')
            .in('handle', parentFamilies);
        rows = ((byHandle ?? []) as FamRow[]).filter((f) =>
            ((f.children as string[]) ?? []).includes(personHandle));
    }
    const birth = rows[0];
    return {
        father: birth?.father_handle ?? null,
        mother: birth?.mother_handle ?? null,
    };
}

/**
 * Computes the generation to show for this person (1-based), using the family graph
 * recursively so each parent's generation reflects *their* parents, not only DB column.
 */
export async function getEffectiveGeneration(personHandle: string): Promise<number | undefined> {
    const { supabase } = await import('@/lib/supabase');
    const cache = new Map<string, number | undefined>();
    const visiting = new Set<string>();

    async function inner(h: string): Promise<number | undefined> {
        if (cache.has(h)) return cache.get(h);
        if (visiting.has(h)) {
            const { data: row } = await supabase.from('people').select('generation').eq('handle', h).single();
            return parseGeneration(row?.generation);
        }
        visiting.add(h);
        try {
            const { data: row } = await supabase
                .from('people')
                .select('generation, parent_families')
                .eq('handle', h)
                .single();
            const stored = parseGeneration(row?.generation);
            const pf = (row?.parent_families as string[]) ?? [];

            const { father: F, mother: M } = await resolveBirthParents(supabase, h, pf);

            if (!F && !M) {
                cache.set(h, stored);
                return stored;
            }

            const fg = F ? await inner(F) : undefined;
            const mg = M ? await inner(M) : undefined;

            if (fg == null && mg == null) {
                cache.set(h, stored);
                return stored;
            }
            const maxP = Math.max(
                fg ?? Number.NEGATIVE_INFINITY,
                mg ?? Number.NEGATIVE_INFINITY,
            );
            if (maxP === Number.NEGATIVE_INFINITY) {
                cache.set(h, stored);
                return stored;
            }
            const out = maxP + 1;
            cache.set(h, out);
            return out;
        } finally {
            visiting.delete(h);
        }
    }

    return inner(personHandle);
}
