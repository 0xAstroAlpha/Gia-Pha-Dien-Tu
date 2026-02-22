/**
 * Utility types and helpers for genealogy data
 */

// ═══ PersonDetail Type ═══
export interface PersonDetail {
    handle: string;
    gramps_id?: string;
    gender: number;
    displayName: string;
    surname?: string;
    firstName?: string;
    generation: number;
    chi?: number;
    birthYear?: number;
    birthDate?: string;
    birthPlace?: string;
    deathYear?: number;
    deathDate?: string;
    deathPlace?: string;
    isLiving: boolean;
    isPrivacyFiltered: boolean;
    isPatrilineal: boolean;
    families?: string[];
    parentFamilies?: string[];
    mediaCount?: number;
    phone?: string;
    email?: string;
    zalo?: string;
    facebook?: string;
    currentAddress?: string;
    hometown?: string;
    occupation?: string;
    company?: string;
    education?: string;
    nickName?: string;
    notes?: string;
    biography?: string;
    tags?: string[];
    _privacyNote?: string;
}

// ═══ Zodiac Year Helper ═══
const CAN = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
const CHI_ZD = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];

export function zodiacYear(year?: number): string | undefined {
    if (!year) return undefined;
    return `${CAN[year % 10]} ${CHI_ZD[year % 12]}`;
}
