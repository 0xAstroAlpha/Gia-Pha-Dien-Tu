import type { Role } from '@prisma/client';
import prisma from '../../config/database';
import type { GrampsPerson, FilteredPerson } from './types';

// Default privacy config
const DEFAULT_PRIVACY: Record<string, string[]> = {
    GUEST: ['displayName'],
    MEMBER: ['displayName', 'surname', 'firstName', 'birthYear'],
    ARCHIVIST: ['displayName', 'surname', 'firstName', 'birthYear', 'birthDate', 'birthPlace'],
    EDITOR: ['displayName', 'surname', 'firstName', 'birthYear', 'birthDate', 'birthPlace', 'phone'],
    ADMIN: ['*'],
};

/**
 * Get privacy config from DB, fallback to defaults
 */
async function getPrivacyConfig(): Promise<Record<string, string[]>> {
    try {
        const config = await prisma.privacyConfig.findFirst();
        if (config) {
            return {
                GUEST: ['displayName'],
                MEMBER: config.memberCanSee as string[],
                ARCHIVIST: config.memberCanSee as string[], // At least member-level
                EDITOR: config.editorCanSee as string[],
                ADMIN: config.adminCanSee as string[],
            };
        }
    } catch {
        // Fallback to defaults
    }
    return DEFAULT_PRIVACY;
}

/**
 * Extract display name from Gramps person
 */
function getDisplayName(person: GrampsPerson): string {
    const name = person.primary_name;
    const surname = name.surname_list?.[0]?.surname || '';
    const firstName = name.first_name || '';
    return `${surname} ${firstName}`.trim() || 'Không rõ tên';
}

/**
 * Extract year from Gramps date
 */
function extractYear(event?: GrampsPerson['birth']): number | undefined {
    if (!event?.date?.dateval?.[0]) return undefined;
    return event.date.dateval[2]; // [day, month, year]
}

function extractDateString(event?: GrampsPerson['birth']): string | undefined {
    if (!event?.date?.dateval) return undefined;
    const [day, month, year] = event.date.dateval;
    if (year) {
        return `${year}${month ? `-${String(month).padStart(2, '0')}` : ''}${day ? `-${String(day).padStart(2, '0')}` : ''}`;
    }
    return event.date.text;
}

/**
 * Determine if a person is living
 */
function isPersonLiving(person: GrampsPerson): boolean {
    return !person.death && !person.deceased;
}

/**
 * Build a FilteredPerson, applying privacy rules for living persons
 */
export async function filterPerson(
    person: GrampsPerson,
    userRole: Role,
): Promise<FilteredPerson> {
    const living = isPersonLiving(person);
    const displayName = getDisplayName(person);
    const surname = person.primary_name.surname_list?.[0]?.surname || '';
    const firstName = person.primary_name.first_name || '';

    // Deceased persons — full data
    if (!living) {
        return {
            handle: person.handle,
            gramps_id: person.gramps_id,
            gender: person.gender,
            displayName,
            surname,
            firstName,
            birthYear: extractYear(person.birth),
            birthDate: extractDateString(person.birth),
            birthPlace: person.birth?.place,
            deathYear: extractYear(person.death),
            deathDate: extractDateString(person.death),
            deathPlace: person.death?.place,
            isLiving: false,
            isPrivacyFiltered: false,
            families: person.family_list,
            parentFamilies: person.parent_family_list,
            mediaCount: person.media_list?.length,
        };
    }

    // Living person — apply privacy filter
    const config = await getPrivacyConfig();
    const allowedFields = config[userRole] || config.MEMBER;

    // Admin sees everything
    if (allowedFields.includes('*')) {
        return {
            handle: person.handle,
            gramps_id: person.gramps_id,
            gender: person.gender,
            displayName,
            surname,
            firstName,
            birthYear: extractYear(person.birth),
            birthDate: extractDateString(person.birth),
            birthPlace: person.birth?.place,
            isLiving: true,
            isPrivacyFiltered: false,
            families: person.family_list,
            parentFamilies: person.parent_family_list,
            mediaCount: person.media_list?.length,
            phone: person.attribute_list?.find((a) => a.type === 'Phone')?.value,
        };
    }

    // Build filtered result
    const filtered: FilteredPerson = {
        handle: person.handle,
        gramps_id: person.gramps_id,
        gender: person.gender,
        displayName: allowedFields.includes('displayName') ? displayName : '🔒 Ẩn',
        surname: allowedFields.includes('surname') ? surname : '',
        firstName: allowedFields.includes('firstName') ? firstName : '',
        isLiving: true,
        isPrivacyFiltered: true,
        _privacyNote: 'Thông tin bị ẩn do chính sách bảo mật người còn sống',
        families: person.family_list,
        parentFamilies: person.parent_family_list,
    };

    if (allowedFields.includes('birthYear')) {
        filtered.birthYear = extractYear(person.birth);
    }
    if (allowedFields.includes('birthDate')) {
        filtered.birthDate = extractDateString(person.birth);
    }
    if (allowedFields.includes('birthPlace')) {
        filtered.birthPlace = person.birth?.place;
    }
    if (allowedFields.includes('phone')) {
        filtered.phone = person.attribute_list?.find((a) => a.type === 'Phone')?.value;
    }

    return filtered;
}

/**
 * Filter multiple persons
 */
export async function filterPeople(
    people: GrampsPerson[],
    userRole: Role,
): Promise<FilteredPerson[]> {
    return Promise.all(people.map((p) => filterPerson(p, userRole)));
}
