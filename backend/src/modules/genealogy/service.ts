import type { Role } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/error-handler';
import { filterPerson, filterPeople } from './privacy-filter';
import { MOCK_PEOPLE, MOCK_FAMILIES } from './mock-data';
import type { GrampsPerson, GrampsFamily, TreeData, TreeNode, TreeFamily } from './types';

const GRAMPS_API = config.grampsWebUrl + '/api';
let USE_MOCK = false; // Auto-detected on first call

/**
 * Fetch from Gramps Web API, fallback to mock data
 */
async function grampsGet<T>(path: string): Promise<T> {
    if (USE_MOCK) {
        return getMockResponse<T>(path);
    }

    try {
        const res = await fetch(`${GRAMPS_API}${path}`, {
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(3000), // 3s timeout
        });

        if (!res.ok) {
            logger.warn({ status: res.status, path }, 'Gramps API error');
            throw new AppError(res.status === 404 ? 404 : 502, 'GRAMPS_ERROR', 'Lỗi kết nối Gramps Web');
        }

        return res.json();
    } catch (error) {
        if (error instanceof AppError) throw error;
        // Gramps Web unavailable — switch to mock
        logger.info('Gramps Web unavailable, switching to mock data for development');
        USE_MOCK = true;
        return getMockResponse<T>(path);
    }
}

/**
 * Return mock data based on API path
 */
function getMockResponse<T>(path: string): T {
    if (path.startsWith('/people/')) {
        const handle = path.split('/')[2]?.split('?')[0];
        const person = MOCK_PEOPLE.find((p) => p.handle === handle);
        if (!person) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy');
        return person as T;
    }
    if (path.startsWith('/people')) {
        return MOCK_PEOPLE as T;
    }
    if (path.startsWith('/families/')) {
        const handle = path.split('/')[2]?.split('?')[0];
        const family = MOCK_FAMILIES.find((f) => f.handle === handle);
        if (!family) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy');
        return family as T;
    }
    if (path.startsWith('/families')) {
        return MOCK_FAMILIES as T;
    }
    throw new AppError(404, 'NOT_FOUND', 'Mock endpoint not found');
}

async function grampsPost<T>(path: string, body: unknown): Promise<T> {
    if (USE_MOCK) throw new AppError(503, 'MOCK_MODE', 'Chế độ mock — không hỗ trợ ghi dữ liệu');

    try {
        const res = await fetch(`${GRAMPS_API}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new AppError(res.status, 'GRAMPS_ERROR', 'Lỗi Gramps Web API');
        return res.json();
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(502, 'GRAMPS_UNAVAILABLE', 'Không thể kết nối tới Gramps Web');
    }
}

async function grampsPut<T>(path: string, body: unknown): Promise<T> {
    if (USE_MOCK) throw new AppError(503, 'MOCK_MODE', 'Chế độ mock — không hỗ trợ ghi dữ liệu');

    try {
        const res = await fetch(`${GRAMPS_API}${path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new AppError(res.status, 'GRAMPS_ERROR', 'Lỗi Gramps Web API');
        return res.json();
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(502, 'GRAMPS_UNAVAILABLE', 'Không thể kết nối tới Gramps Web');
    }
}

async function grampsDelete(path: string): Promise<void> {
    if (USE_MOCK) throw new AppError(503, 'MOCK_MODE', 'Chế độ mock — không hỗ trợ ghi dữ liệu');

    try {
        const res = await fetch(`${GRAMPS_API}${path}`, { method: 'DELETE' });
        if (!res.ok) throw new AppError(res.status, 'GRAMPS_ERROR', 'Lỗi Gramps Web API');
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(502, 'GRAMPS_UNAVAILABLE', 'Không thể kết nối tới Gramps Web');
    }
}

export class GenealogyService {
    // === GET /people ===
    async getPeople(userRole: Role) {
        const rawPeople = await grampsGet<GrampsPerson[]>('/people/?extend=all');
        return filterPeople(rawPeople, userRole);
    }

    // === GET /people/:handle ===
    async getPerson(handle: string, userRole: Role) {
        const rawPerson = await grampsGet<GrampsPerson>(`/people/${handle}?extend=all`);
        return filterPerson(rawPerson, userRole);
    }

    // === GET /families ===
    async getFamilies() {
        return grampsGet<GrampsFamily[]>('/families/?extend=all');
    }

    // === GET /families/:handle ===
    async getFamily(handle: string) {
        return grampsGet<GrampsFamily>(`/families/${handle}?extend=all`);
    }

    // === GET /tree — aggregated data for tree visualization ===
    async getTree(userRole: Role): Promise<TreeData> {
        const [rawPeople, rawFamilies] = await Promise.all([
            grampsGet<GrampsPerson[]>('/people/?extend=all'),
            grampsGet<GrampsFamily[]>('/families/'),
        ]);

        const filteredPeople = await filterPeople(rawPeople, userRole);

        const people: TreeNode[] = filteredPeople.map((p) => ({
            handle: p.handle,
            displayName: p.displayName,
            gender: p.gender,
            birthYear: p.birthYear,
            deathYear: p.deathYear,
            isLiving: p.isLiving,
            isPrivacyFiltered: p.isPrivacyFiltered,
            families: p.families || [],
            parentFamilies: p.parentFamilies || [],
        }));

        const families: TreeFamily[] = rawFamilies.map((f) => ({
            handle: f.handle,
            fatherHandle: f.father_handle,
            motherHandle: f.mother_handle,
            children: f.child_ref_list?.map((c) => c.ref) || [],
        }));

        return { people, families };
    }

    // === Write operations — Editor+ ===
    async updatePerson(handle: string, data: unknown) {
        return grampsPut(`/people/${handle}`, data);
    }

    async addPerson(data: unknown) {
        return grampsPost('/people/', data);
    }

    async addFamily(data: unknown) {
        return grampsPost('/families/', data);
    }

    async deletePerson(handle: string) {
        return grampsDelete(`/people/${handle}`);
    }
}

export const genealogyService = new GenealogyService();
