// Types for Gramps Web API responses

export interface GrampsPerson {
    handle: string;
    gramps_id: string;
    gender: number; // 0=unknown, 1=male, 2=female
    primary_name: {
        first_name: string;
        surname_list: Array<{ surname: string }>;
        display_as?: string;
    };
    alternate_names?: Array<{
        first_name: string;
        surname_list: Array<{ surname: string }>;
    }>;
    birth_ref_index?: number;
    death_ref_index?: number;
    event_ref_list?: Array<{
        ref: string;
        role: string;
    }>;
    family_list?: string[];        // Family handles as parent
    parent_family_list?: string[]; // Family handles as child
    media_list?: Array<{ ref: string }>;
    note_list?: string[];
    attribute_list?: Array<{ type: string; value: string }>;
    change: number; // timestamp
    // Derived fields
    birth?: GrampsEvent | null;
    death?: GrampsEvent | null;
    deceased?: boolean;
}

export interface GrampsEvent {
    handle: string;
    gramps_id: string;
    type: string;
    date?: {
        dateval?: number[];
        text?: string;
    };
    place?: string;
    description?: string;
}

export interface GrampsFamily {
    handle: string;
    gramps_id: string;
    father_handle?: string;
    mother_handle?: string;
    child_ref_list?: Array<{ ref: string }>;
    type?: string;
    event_ref_list?: Array<{ ref: string }>;
}

export interface FilteredPerson {
    handle: string;
    gramps_id: string;
    gender: number;
    displayName: string;
    surname: string;
    firstName: string;
    birthYear?: number;
    birthDate?: string;
    birthPlace?: string;
    deathYear?: number;
    deathDate?: string;
    deathPlace?: string;
    isLiving: boolean;
    isPrivacyFiltered: boolean;
    _privacyNote?: string;
    families?: string[];
    parentFamilies?: string[];
    mediaCount?: number;
    phone?: string;
}

export interface TreeNode {
    handle: string;
    displayName: string;
    gender: number;
    birthYear?: number;
    deathYear?: number;
    isLiving: boolean;
    isPrivacyFiltered: boolean;
    families: string[];
    parentFamilies: string[];
}

export interface TreeFamily {
    handle: string;
    fatherHandle?: string;
    motherHandle?: string;
    children: string[];
}

export interface TreeData {
    people: TreeNode[];
    families: TreeFamily[];
}
