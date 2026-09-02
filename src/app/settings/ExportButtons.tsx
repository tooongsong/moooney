'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportTransactionsCSV, exportTransactionsJSON, deleteAllData } from '@/app/actions/settings';

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons() {
  const [csvLoading, setCsvLoading] = useState(false);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const date = new Date().toISOString().slice(0, 10);

  async function handleCSV() {
    setCsvLoading(true);
    try {
      const csv = await exportTransactionsCSV();
      download(csv, `moooney-${date}.csv`, 'text/csv');
    } finally {
      setCsvLoading(false);
    }
  }

  async function handleJSON() {
    setJsonLoading(true);
    try {
      const json = await exportTransactionsJSON();
      download(json, `moooney-${date}.json`, 'application/json');
    } finally {
      setJsonLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete all transactions and categories? This cannot be undone.')) return;
    setDeleteLoading(true);
    const res = await deleteAllData();
    setDeleteLoading(false);
    if (res.success) toast.success('All data deleted.');
    else toast.error(res.error ?? 'Could not delete data.');
  }

  return (
    <div className="divide-y divide-line">
      <div className="py-3 flex items-center justify-between">
        <span className="text-sm text-ink">Export CSV</span>
        <button
          type="button"
          onClick={handleCSV}
          disabled={csvLoading}
          className="text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors flex items-center gap-1.5 disabled:opacity-40"
        >
          {csvLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Download
        </button>
      </div>
      <div className="py-3 flex items-center justify-between">
        <span className="text-sm text-ink">Export JSON</span>
        <button
          type="button"
          onClick={handleJSON}
          disabled={jsonLoading}
          className="text-[10px] font-bold uppercase tracking-widest text-ink-faint hover:text-ink transition-colors flex items-center gap-1.5 disabled:opacity-40"
        >
          {jsonLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Download
        </button>
      </div>
      <div className="py-3 flex items-center justify-between">
        <span className="text-sm text-ink">Delete all data</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteLoading}
          className="text-[10px] font-bold uppercase tracking-widest text-accent hover:opacity-70 transition-opacity flex items-center gap-1.5 disabled:opacity-40"
        >
          {deleteLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Delete
        </button>
      </div>
    </div>
  );
}
