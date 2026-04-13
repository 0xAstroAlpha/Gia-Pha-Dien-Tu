#!/usr/bin/env python3
"""One-off generator: builds person-form-dialog.tsx from people/page.tsx"""
from pathlib import Path

page = Path(__file__).resolve().parent.parent / "src/app/(main)/people/page.tsx"
text = page.read_text()
lines = text.splitlines()

def join(a, b):
    return "\n".join(lines[a - 1 : b])

out = []
out.append("'use client';")
out.append("")
out.append("import { useEffect, useMemo, useState } from 'react';")
out.append("import { X } from 'lucide-react';")
out.append("import { Input } from '@/components/ui/input';")
out.append("import { Badge } from '@/components/ui/badge';")
out.append("import { Button } from '@/components/ui/button';")
out.append("import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';")
out.append("import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';")
out.append("")
out.append("export interface PersonFormPerson {")
out.append("    handle: string;")
out.append("    displayName: string;")
out.append("    gender: number;")
out.append("    birthYear?: number;")
out.append("    deathYear?: number;")
out.append("    isLiving: boolean;")
out.append("    isPrivacyFiltered: boolean;")
out.append("}")
out.append("")
out.append("export interface PersonFormDialogProps {")
out.append("    open: boolean;")
out.append("    onOpenChange: (open: boolean) => void;")
out.append("    people: PersonFormPerson[];")
out.append("    /** null = create new person */")
out.append("    targetEditHandle: string | null;")
out.append("    onSaved?: (payload: { handle: string; created: boolean }) => void;")
out.append("}")
out.append("")
out.append("export function PersonFormDialog({ open, onOpenChange, people, targetEditHandle, onSaved }: PersonFormDialogProps) {")

# State 41-59 (skip 40 createOpen)
body = join(41, 59)
body = body.replace(
    "const [editHandle, setEditHandle]",
    "const [internalEditHandle, setInternalEditHandle]",
)
for line in body.splitlines():
    out.append("    " + line)

out.append("")
# openCreateModal 86-104
for line in join(86, 104).splitlines():
    line = line.replace("setCreateOpen(true)", "onOpenChange(true)")
    out.append("    " + line)

out.append("")
# openEditModal 106-167
block = join(106, 167)
block = block.replace("setEditHandle", "setInternalEditHandle")
block = block.replace("setCreateOpen(true)", "onOpenChange(true)")
for line in block.splitlines():
    out.append("    " + line)

out.append("")
# handleCreate 169-540
block = join(169, 540)
block = block.replace("editHandle", "internalEditHandle")
block = block.replace("setEditHandle", "setInternalEditHandle")
block = block.replace("setCreateOpen(false)", "onOpenChange(false)")
# onSaved after successful save
insert = "            onSaved?.({ handle: personHandle, created: !internalEditHandle });\n"
marker = "            setEditBirthFamilyHandle(null);"
if marker in block:
    block = block.replace(marker, marker + "\n" + insert)
else:
    raise SystemExit("marker not found for onSaved")

for line in block.splitlines():
    out.append("    " + line)

out.append("")
# memos 549-576
block = join(549, 576)
block = block.replace("editHandle", "internalEditHandle")
for line in block.splitlines():
    out.append("    " + line)

out.append("")
# Sync props -> internal edit handle when opening
out.append("    useEffect(() => {")
out.append("        if (!open) return;")
out.append("        if (targetEditHandle) {")
out.append("            void openEditModal(targetEditHandle);")
out.append("        } else {")
out.append("            openCreateModal();")
out.append("        }")
out.append("    }, [open, targetEditHandle]); // eslint-disable-line react-hooks/exhaustive-deps")
out.append("")

# dialog 688-1018
block = join(688, 1018)
block = block.replace("createOpen", "open")
block = block.replace("setCreateOpen(false)", "onOpenChange(false)")
block = block.replace("editHandle", "internalEditHandle")
for line in block.splitlines():
    out.append("    " + line)

out.append("}")
out.append("")

dest = Path(__file__).resolve().parent.parent / "src/components/person-form-dialog.tsx"
dest.write_text("\n".join(out) + "\n")
print("Wrote", dest, "lines", len(out))
