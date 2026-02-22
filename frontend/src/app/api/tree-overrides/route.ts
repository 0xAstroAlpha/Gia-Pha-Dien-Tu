import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'tree-overrides.json');

interface Overrides {
    families: Record<string, { children: string[] }>;
    persons: Record<string, { isLiving?: boolean }>;
}

function readOverrides(): Overrides {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return { families: {}, persons: {} };
    }
}

function writeOverrides(data: Overrides): void {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/** GET — return current overrides */
export async function GET() {
    return NextResponse.json(readOverrides());
}

/** POST — update overrides (partial merge) */
export async function POST(req: NextRequest) {
    const body = await req.json();
    const current = readOverrides();

    if (body.families) {
        current.families = { ...current.families, ...body.families };
    }
    if (body.persons) {
        current.persons = { ...current.persons, ...body.persons };
    }

    writeOverrides(current);
    return NextResponse.json(current);
}

/** DELETE — reset all overrides */
export async function DELETE() {
    writeOverrides({ families: {}, persons: {} });
    return NextResponse.json({ families: {}, persons: {} });
}
