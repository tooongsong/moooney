'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { updateCardNotes } from '@/app/actions/accounts';

const LINK = 'text-xs font-semibold uppercase tracking-widest text-ink underline underline-offset-4';

export function CardNotes({ accountId, initial }: { accountId: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(initial === '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const result = await updateCardNotes(accountId, draft);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    setNotes(draft.trim());
    setDraft(draft.trim());
    setEditing(draft.trim() === '');
    toast.success('Saved');
  }

  if (!editing) {
    return (
      <section className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Details</p>
          <button type="button" onClick={() => setEditing(true)} className={LINK}>Edit</button>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{notes}</p>
      </section>
    );
  }

  return (
    <section className="pt-6 space-y-3">
      <div className="flex items-center justify-between">
        <label htmlFor="card-notes" className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Details</label>
        {notes !== '' && (
          <button type="button" onClick={() => { setDraft(notes); setEditing(false); }} className={LINK}>Cancel</button>
        )}
      </div>
      <Textarea id="card-notes" value={draft} onChange={(e) => setDraft(e.target.value)} rows={12}
        placeholder="Rates by merchant, caps, closing date — anything worth remembering about this card."
        className="min-h-64 leading-relaxed" />
      <button type="button" onClick={save} disabled={saving}
        className="w-full h-12 rounded-lg bg-accent text-white text-sm font-semibold uppercase tracking-widest flex items-center justify-center disabled:opacity-50">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save'}
      </button>
    </section>
  );
}
