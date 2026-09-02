'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, ArrowUp, Camera, Loader2, PenLine, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  extractDraft,
  saveTransaction,
  saveTransactions,
  type TransactionDraft,
  type SaveTransactionInput,
} from '@/app/actions/transactions';
import { ConfirmTransactionForm, type ConfirmFormValues } from '@/components/ConfirmTransactionForm';
import { BatchConfirmList } from '@/components/BatchConfirmList';
import { PageHeader } from '@/components/PageHeader';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { getAllCategories, getPaymentMethodNames } from '@/app/actions/manage';
import { CATEGORIES, DEFAULT_CATEGORY } from '@/lib/categories';
import { toDateInputValue } from '@/lib/utils';

const EXAMPLES = ['Target $43.28 home supplies', 'Lunch at Din Tai Fung $36.50', 'Costco $68.20 groceries'];
const PENDING_DRAFTS_KEY = 'moooney_pending_drafts';

function loadPendingDrafts(): TransactionDraft[] | null {
  try {
    const raw = sessionStorage.getItem(PENDING_DRAFTS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePendingDrafts(drafts: TransactionDraft[] | null) {
  try {
    if (drafts) {
      sessionStorage.setItem(PENDING_DRAFTS_KEY, JSON.stringify(drafts));
    } else {
      sessionStorage.removeItem(PENDING_DRAFTS_KEY);
    }
  } catch {
    // Storage full or unavailable — the review list just won't survive a reload this time.
  }
}

function draftToFormValues(draft: TransactionDraft): ConfirmFormValues {
  return {
    amount: draft.amount != null ? String(draft.amount) : '',
    merchant: draft.merchant || '',
    category: draft.category || DEFAULT_CATEGORY,
    date: draft.date || toDateInputValue(),
    type: draft.type,
    description: draft.description || '',
    paymentMethod: draft.paymentMethod || '',
    notes: '',
    items: draft.items,
  };
}

function emptyFormValues(): ConfirmFormValues {
  return {
    amount: '',
    merchant: '',
    category: DEFAULT_CATEGORY,
    date: toDateInputValue(),
    type: 'expense',
    description: '',
    paymentMethod: '',
    notes: '',
    items: null,
  };
}

export default function AddPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Reading…');
  const [drafts, setDrafts] = useState<TransactionDraft[] | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [restored, setRestored] = useState(false);
  const [categories, setCategories] = useState<string[]>([...CATEGORIES]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);

  useEffect(() => {
    getAllCategories().then(setCategories);
    getPaymentMethodNames().then(setPaymentMethods);
  }, []);

  // Recover an in-progress review list if the page reloaded (e.g. the tab was
  // backgrounded on the phone) before the user finished confirming. This has to run
  // as a post-hydration effect, not a useState initializer, because sessionStorage
  // isn't available during SSR and reading it synchronously on the client's first
  // render would produce a hydration mismatch against the server-rendered markup.
  useEffect(() => {
    const pending = loadPendingDrafts();
    if (pending && pending.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrafts(pending);
      toast.info('Restored your unsaved review');
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (restored) savePendingDrafts(drafts);
  }, [drafts, restored]);

  async function runExtraction(input: { text?: string; imageBase64?: string }, label: string) {
    setIsExtracting(true);
    setLoadingLabel(label);
    const result = await extractDraft(input);
    setIsExtracting(false);
    if (result.success) {
      setDrafts(result.drafts);
    } else {
      toast.error(result.error);
    }
  }

  async function submitText() {
    if (!text.trim() || isExtracting) return;
    await runExtraction({ text: text.trim() }, 'Understanding…');
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const imageBase64 = reader.result as string;
      await runExtraction({ imageBase64 }, 'Scanning…');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleSave(input: SaveTransactionInput) {
    const result = await saveTransaction(input);
    if (result.success) {
      savePendingDrafts(null);
      toast.success('Saved');
      router.push('/');
    } else {
      toast.error(result.error);
    }
  }

  async function handleBatchSave(inputs: SaveTransactionInput[]) {
    const result = await saveTransactions(inputs);
    if (result.success) {
      savePendingDrafts(null);
      toast.success(`Saved ${result.count} transactions`);
      router.push('/');
    } else {
      toast.error(result.error);
    }
  }

  function reset() {
    setDrafts(null);
    setManualMode(false);
    setText('');
  }

  const isSingle = drafts !== null && drafts.length === 1;
  const isBatch = drafts !== null && drafts.length > 1;
  const showConfirm = drafts !== null || manualMode;

  return (
    <div className="d-max-md max-lg:max-w-md mx-auto px-6 min-h-screen bg-paper flex flex-col">
      <PageHeader
        left={
          <HeaderIconButton className="-ml-2" onClick={() => (showConfirm ? reset() : router.push('/'))}>
            <X />
          </HeaderIconButton>
        }
        title={isBatch ? 'Review transactions' : showConfirm ? 'Confirm' : 'Add expense'}
      />

      {isExtracting && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 pb-20">
          <Loader2 className="h-6 w-6 animate-spin text-ink-faint" />
          <p className="text-sm text-ink-faint">{loadingLabel}</p>
        </div>
      )}

      {!isExtracting && isSingle && drafts && (
        <div className="pt-6 pb-10">
          <ConfirmTransactionForm
            initial={draftToFormValues(drafts[0])}
            categories={categories}
            paymentMethods={paymentMethods}
            receiptImage={drafts[0].receiptImage}
            needsReview={drafts[0].needsReview}
            onSave={handleSave}
            onCancel={reset}
          />
        </div>
      )}

      {!isExtracting && isBatch && drafts && (
        <div className="pt-6 pb-10">
          <BatchConfirmList
            drafts={drafts}
            categories={categories}
            receiptImage={drafts[0]?.receiptImage}
            onSave={handleBatchSave}
            onCancel={reset}
          />
        </div>
      )}

      {!isExtracting && !drafts && manualMode && (
        <div className="pt-6 pb-10">
          <ConfirmTransactionForm
            initial={emptyFormValues()}
            categories={categories}
            paymentMethods={paymentMethods}
            onSave={handleSave}
            onCancel={reset}
          />
        </div>
      )}

      {!isExtracting && !showConfirm && (
        <div className="flex-1 flex flex-col justify-center pb-24">
          <textarea
            autoFocus
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitText();
              }
            }}
            placeholder="What did you spend?"
            className="w-full text-4xl leading-tight font-bold tracking-tight text-ink placeholder:text-ink-faint bg-transparent outline-none resize-none"
          />
          <p className="text-sm text-ink-faint mt-3">e.g. &ldquo;{EXAMPLES[0]}&rdquo;</p>

          <div className="flex justify-end mt-6">
            <button
              onClick={submitText}
              disabled={!text.trim()}
              className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center disabled:opacity-20 active:scale-95 transition-all"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>

          <div className="flex gap-0.5 mt-10">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 h-16 bg-sand flex flex-col items-center justify-center gap-1.5 text-ink-soft active:opacity-70 transition-opacity"
            >
              <Camera className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-widest">Receipt</span>
            </button>
            <button
              onClick={() => setManualMode(true)}
              className="flex-1 h-16 bg-sand flex flex-col items-center justify-center gap-1.5 text-ink-soft active:opacity-70 transition-opacity"
            >
              <PenLine className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-widest">Manual</span>
            </button>
            <button
              onClick={() => router.push('/transfer')}
              className="flex-1 h-16 bg-sand flex flex-col items-center justify-center gap-1.5 text-ink-soft active:opacity-70 transition-opacity"
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-widest">Transfer</span>
            </button>
          </div>

          <p className="text-center text-xs text-ink-faint mt-4">Also works with a photo of a statement — it&apos;ll find every transaction</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
