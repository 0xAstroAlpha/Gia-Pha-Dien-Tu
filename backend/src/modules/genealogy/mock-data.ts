/**
 * Mock genealogy data — Dòng họ Lê Huy (4 thế hệ)
 * Used when Gramps Web is unavailable for UI development/testing.
 */

import type { GrampsPerson, GrampsFamily } from './types';

// === Thế hệ 1: Ông bà cố ===
const person_G1_M: GrampsPerson = {
    handle: 'P001',
    gramps_id: 'I0001',
    gender: 1,
    primary_name: { first_name: 'Hữu', surname_list: [{ surname: 'Lê' }] },
    birth: { handle: 'E001', gramps_id: 'E0001', type: 'Birth', date: { dateval: [15, 3, 1920] }, place: 'Hà Nội' },
    death: { handle: 'E002', gramps_id: 'E0002', type: 'Death', date: { dateval: [10, 8, 1995] }, place: 'Hà Nội' },
    deceased: true,
    family_list: ['F001'],
    parent_family_list: [],
    media_list: [],
    note_list: [],
    attribute_list: [],
    change: 0,
};

const person_G1_F: GrampsPerson = {
    handle: 'P002',
    gramps_id: 'I0002',
    gender: 2,
    primary_name: { first_name: 'Thị Lan', surname_list: [{ surname: 'Nguyễn' }] },
    birth: { handle: 'E003', gramps_id: 'E0003', type: 'Birth', date: { dateval: [22, 7, 1925] }, place: 'Nam Định' },
    death: { handle: 'E004', gramps_id: 'E0004', type: 'Death', date: { dateval: [5, 1, 2005] }, place: 'Hà Nội' },
    deceased: true,
    family_list: ['F001'],
    parent_family_list: [],
    media_list: [],
    note_list: [],
    attribute_list: [],
    change: 0,
};

// === Thế hệ 2: Ông bà ===
const person_G2_M1: GrampsPerson = {
    handle: 'P003',
    gramps_id: 'I0003',
    gender: 1,
    primary_name: { first_name: 'Văn Đức', surname_list: [{ surname: 'Lê' }] },
    birth: { handle: 'E005', gramps_id: 'E0005', type: 'Birth', date: { dateval: [8, 12, 1945] }, place: 'Hà Nội' },
    death: { handle: 'E006', gramps_id: 'E0006', type: 'Death', date: { dateval: [20, 6, 2020] }, place: 'Hà Nội' },
    deceased: true,
    family_list: ['F002'],
    parent_family_list: ['F001'],
    media_list: [{ ref: 'M001' }],
    note_list: [],
    attribute_list: [],
    change: 0,
};

const person_G2_F1: GrampsPerson = {
    handle: 'P004',
    gramps_id: 'I0004',
    gender: 2,
    primary_name: { first_name: 'Thị Mai', surname_list: [{ surname: 'Trần' }] },
    birth: { handle: 'E007', gramps_id: 'E0007', type: 'Birth', date: { dateval: [14, 5, 1948] }, place: 'Hải Phòng' },
    family_list: ['F002'],
    parent_family_list: [],
    media_list: [{ ref: 'M002' }],
    note_list: [],
    attribute_list: [{ type: 'Phone', value: '0912 345 678' }],
    change: 0,
};

const person_G2_M2: GrampsPerson = {
    handle: 'P005',
    gramps_id: 'I0005',
    gender: 1,
    primary_name: { first_name: 'Huy Hoàng', surname_list: [{ surname: 'Lê' }] },
    birth: { handle: 'E008', gramps_id: 'E0008', type: 'Birth', date: { dateval: [3, 9, 1950] }, place: 'Hà Nội' },
    death: { handle: 'E009', gramps_id: 'E0009', type: 'Death', date: { dateval: [11, 3, 2018] }, place: 'TP.HCM' },
    deceased: true,
    family_list: ['F003'],
    parent_family_list: ['F001'],
    media_list: [],
    note_list: [],
    attribute_list: [],
    change: 0,
};

const person_G2_F2: GrampsPerson = {
    handle: 'P006',
    gramps_id: 'I0006',
    gender: 2,
    primary_name: { first_name: 'Thị Hoa', surname_list: [{ surname: 'Phạm' }] },
    birth: { handle: 'E010', gramps_id: 'E0010', type: 'Birth', date: { dateval: [28, 2, 1953] }, place: 'TP.HCM' },
    family_list: ['F003'],
    parent_family_list: [],
    media_list: [],
    note_list: [],
    attribute_list: [{ type: 'Phone', value: '0908 765 432' }],
    change: 0,
};

const person_G2_F3: GrampsPerson = {
    handle: 'P007',
    gramps_id: 'I0007',
    gender: 2,
    primary_name: { first_name: 'Thị Hương', surname_list: [{ surname: 'Lê' }] },
    birth: { handle: 'E011', gramps_id: 'E0011', type: 'Birth', date: { dateval: [17, 11, 1955] }, place: 'Hà Nội' },
    family_list: [],
    parent_family_list: ['F001'],
    media_list: [],
    note_list: [],
    attribute_list: [{ type: 'Phone', value: '0976 543 210' }],
    change: 0,
};

// === Thế hệ 3: Bố mẹ ===
const person_G3_M1: GrampsPerson = {
    handle: 'P008',
    gramps_id: 'I0008',
    gender: 1,
    primary_name: { first_name: 'Minh Tuấn', surname_list: [{ surname: 'Lê' }] },
    birth: { handle: 'E012', gramps_id: 'E0012', type: 'Birth', date: { dateval: [25, 4, 1970] }, place: 'Hà Nội' },
    family_list: ['F004'],
    parent_family_list: ['F002'],
    media_list: [{ ref: 'M003' }, { ref: 'M004' }],
    note_list: [],
    attribute_list: [{ type: 'Phone', value: '0983 111 222' }],
    change: 0,
};

const person_G3_F1: GrampsPerson = {
    handle: 'P009',
    gramps_id: 'I0009',
    gender: 2,
    primary_name: { first_name: 'Thu Hà', surname_list: [{ surname: 'Vũ' }] },
    birth: { handle: 'E013', gramps_id: 'E0013', type: 'Birth', date: { dateval: [12, 8, 1973] }, place: 'Hà Nội' },
    family_list: ['F004'],
    parent_family_list: [],
    media_list: [{ ref: 'M005' }],
    note_list: [],
    attribute_list: [{ type: 'Phone', value: '0987 333 444' }],
    change: 0,
};

const person_G3_F2: GrampsPerson = {
    handle: 'P010',
    gramps_id: 'I0010',
    gender: 2,
    primary_name: { first_name: 'Thị Ngọc', surname_list: [{ surname: 'Lê' }] },
    birth: { handle: 'E014', gramps_id: 'E0014', type: 'Birth', date: { dateval: [6, 1, 1975] }, place: 'Hà Nội' },
    family_list: ['F005'],
    parent_family_list: ['F002'],
    media_list: [],
    note_list: [],
    attribute_list: [],
    change: 0,
};

const person_G3_M2: GrampsPerson = {
    handle: 'P011',
    gramps_id: 'I0011',
    gender: 1,
    primary_name: { first_name: 'Quốc Bảo', surname_list: [{ surname: 'Đỗ' }] },
    birth: { handle: 'E015', gramps_id: 'E0015', type: 'Birth', date: { dateval: [19, 6, 1972] }, place: 'Đà Nẵng' },
    family_list: ['F005'],
    parent_family_list: [],
    media_list: [],
    note_list: [],
    attribute_list: [{ type: 'Phone', value: '0909 555 666' }],
    change: 0,
};

const person_G3_M3: GrampsPerson = {
    handle: 'P012',
    gramps_id: 'I0012',
    gender: 1,
    primary_name: { first_name: 'Thành Trung', surname_list: [{ surname: 'Lê' }] },
    birth: { handle: 'E016', gramps_id: 'E0016', type: 'Birth', date: { dateval: [30, 10, 1978] }, place: 'TP.HCM' },
    family_list: ['F006'],
    parent_family_list: ['F003'],
    media_list: [],
    note_list: [],
    attribute_list: [{ type: 'Phone', value: '0918 777 888' }],
    change: 0,
};

const person_G3_F3: GrampsPerson = {
    handle: 'P013',
    gramps_id: 'I0013',
    gender: 2,
    primary_name: { first_name: 'Minh Châu', surname_list: [{ surname: 'Hoàng' }] },
    birth: { handle: 'E017', gramps_id: 'E0017', type: 'Birth', date: { dateval: [8, 3, 1982] }, place: 'TP.HCM' },
    family_list: ['F006'],
    parent_family_list: [],
    media_list: [],
    note_list: [],
    attribute_list: [{ type: 'Phone', value: '0932 999 000' }],
    change: 0,
};

const person_G3_F4: GrampsPerson = {
    handle: 'P014',
    gramps_id: 'I0014',
    gender: 2,
    primary_name: { first_name: 'Thanh Tâm', surname_list: [{ surname: 'Lê' }] },
    birth: { handle: 'E018', gramps_id: 'E0018', type: 'Birth', date: { dateval: [14, 7, 1980] }, place: 'TP.HCM' },
    family_list: [],
    parent_family_list: ['F003'],
    media_list: [],
    note_list: [],
    attribute_list: [],
    change: 0,
};

// === Thế hệ 4: Con cháu ===
const person_G4_M1: GrampsPerson = {
    handle: 'P015',
    gramps_id: 'I0015',
    gender: 1,
    primary_name: { first_name: 'Huy', surname_list: [{ surname: 'Lê' }] },
    birth: { handle: 'E019', gramps_id: 'E0019', type: 'Birth', date: { dateval: [15, 5, 1998] }, place: 'Hà Nội' },
    family_list: [],
    parent_family_list: ['F004'],
    media_list: [{ ref: 'M006' }],
    note_list: [],
    attribute_list: [{ type: 'Phone', value: '0369 123 456' }],
    change: 0,
};

const person_G4_F1: GrampsPerson = {
    handle: 'P016',
    gramps_id: 'I0016',
    gender: 2,
    primary_name: { first_name: 'Thùy Linh', surname_list: [{ surname: 'Lê' }] },
    birth: { handle: 'E020', gramps_id: 'E0020', type: 'Birth', date: { dateval: [22, 9, 2001] }, place: 'Hà Nội' },
    family_list: [],
    parent_family_list: ['F004'],
    media_list: [],
    note_list: [],
    attribute_list: [{ type: 'Phone', value: '0358 789 012' }],
    change: 0,
};

const person_G4_M2: GrampsPerson = {
    handle: 'P017',
    gramps_id: 'I0017',
    gender: 1,
    primary_name: { first_name: 'Gia Bảo', surname_list: [{ surname: 'Đỗ' }] },
    birth: { handle: 'E021', gramps_id: 'E0021', type: 'Birth', date: { dateval: [3, 12, 2000] }, place: 'Hà Nội' },
    family_list: [],
    parent_family_list: ['F005'],
    media_list: [],
    note_list: [],
    attribute_list: [],
    change: 0,
};

const person_G4_F2: GrampsPerson = {
    handle: 'P018',
    gramps_id: 'I0018',
    gender: 2,
    primary_name: { first_name: 'Khánh Linh', surname_list: [{ surname: 'Đỗ' }] },
    birth: { handle: 'E022', gramps_id: 'E0022', type: 'Birth', date: { dateval: [18, 6, 2004] }, place: 'Hà Nội' },
    family_list: [],
    parent_family_list: ['F005'],
    media_list: [],
    note_list: [],
    attribute_list: [],
    change: 0,
};

const person_G4_M3: GrampsPerson = {
    handle: 'P019',
    gramps_id: 'I0019',
    gender: 1,
    primary_name: { first_name: 'Minh Khôi', surname_list: [{ surname: 'Lê' }] },
    birth: { handle: 'E023', gramps_id: 'E0023', type: 'Birth', date: { dateval: [7, 4, 2008] }, place: 'TP.HCM' },
    family_list: [],
    parent_family_list: ['F006'],
    media_list: [],
    note_list: [],
    attribute_list: [],
    change: 0,
};

const person_G4_F3: GrampsPerson = {
    handle: 'P020',
    gramps_id: 'I0020',
    gender: 2,
    primary_name: { first_name: 'An Nhiên', surname_list: [{ surname: 'Lê' }] },
    birth: { handle: 'E024', gramps_id: 'E0024', type: 'Birth', date: { dateval: [29, 11, 2012] }, place: 'TP.HCM' },
    family_list: [],
    parent_family_list: ['F006'],
    media_list: [],
    note_list: [],
    attribute_list: [],
    change: 0,
};

// === Families ===
const family_F001: GrampsFamily = {
    handle: 'F001',
    gramps_id: 'F0001',
    father_handle: 'P001',
    mother_handle: 'P002',
    child_ref_list: [{ ref: 'P003' }, { ref: 'P005' }, { ref: 'P007' }],
    type: 'Married',
};

const family_F002: GrampsFamily = {
    handle: 'F002',
    gramps_id: 'F0002',
    father_handle: 'P003',
    mother_handle: 'P004',
    child_ref_list: [{ ref: 'P008' }, { ref: 'P010' }],
    type: 'Married',
};

const family_F003: GrampsFamily = {
    handle: 'F003',
    gramps_id: 'F0003',
    father_handle: 'P005',
    mother_handle: 'P006',
    child_ref_list: [{ ref: 'P012' }, { ref: 'P014' }],
    type: 'Married',
};

const family_F004: GrampsFamily = {
    handle: 'F004',
    gramps_id: 'F0004',
    father_handle: 'P008',
    mother_handle: 'P009',
    child_ref_list: [{ ref: 'P015' }, { ref: 'P016' }],
    type: 'Married',
};

const family_F005: GrampsFamily = {
    handle: 'F005',
    gramps_id: 'F0005',
    father_handle: 'P011',
    mother_handle: 'P010',
    child_ref_list: [{ ref: 'P017' }, { ref: 'P018' }],
    type: 'Married',
};

const family_F006: GrampsFamily = {
    handle: 'F006',
    gramps_id: 'F0006',
    father_handle: 'P012',
    mother_handle: 'P013',
    child_ref_list: [{ ref: 'P019' }, { ref: 'P020' }],
    type: 'Married',
};

// === Export ===
export const MOCK_PEOPLE: GrampsPerson[] = [
    person_G1_M, person_G1_F,
    person_G2_M1, person_G2_F1, person_G2_M2, person_G2_F2, person_G2_F3,
    person_G3_M1, person_G3_F1, person_G3_F2, person_G3_M2, person_G3_M3, person_G3_F3, person_G3_F4,
    person_G4_M1, person_G4_F1, person_G4_M2, person_G4_F2, person_G4_M3, person_G4_F3,
];

export const MOCK_FAMILIES: GrampsFamily[] = [
    family_F001, family_F002, family_F003, family_F004, family_F005, family_F006,
];
