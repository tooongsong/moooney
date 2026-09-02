'use client';

import { useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { updateProfile } from '@/app/actions/settings';

interface Props {
  name: string;
  email: string;
  avatarUrl: string | null;
}

export function ProfileSection({ name, email, avatarUrl }: Props) {
  const [editing, setEditing] = useState(false);
  const [currentName, setCurrentName] = useState(name);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  const initials = (currentName || email)[0]?.toUpperCase() ?? '?';

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    const res = await updateProfile(trimmed);
    setSaving(false);
    if (res.success) {
      setCurrentName(trimmed);
      setEditing(false);
      toast.success('Name updated.');
    } else {
      toast.error(res.error ?? 'Could not update name.');
    }
  }

  return (
    <div className="py-3 flex items-center gap-4">
      {/* Avatar */}
      {avatarUrl ? (
        <img src={avatarUrl} alt={currentName} className="w-10 h-10 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-sand flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-ink">{initials}</span>
        </div>
      )}

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') { setEditing(false); setDraft(currentName); }
              }}
              className="flex-1 text-sm font-semibold text-ink bg-transparent border-b border-line outline-none pb-0.5 min-w-0"
            />
            <button type="button" onClick={() => { setEditing(false); setDraft(currentName); }} className="text-ink-faint hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={save} disabled={saving || !draft.trim()} className="text-ink-faint hover:text-ink disabled:opacity-40">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink truncate">{currentName}</span>
            <button type="button" onClick={() => { setDraft(currentName); setEditing(true); }} className="text-ink-faint hover:text-ink">
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
        <p className="text-xs text-ink-faint truncate mt-0.5">{email}</p>
      </div>
    </div>
  );
}
