'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Camera, Check, ImagePlus, Loader2, PenLine, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { toDateInputValue } from '@/lib/utils';
import { extractDraft, saveTransaction, type TransactionDraft } from '@/app/actions/transactions';
import { DEFAULT_CATEGORY } from '@/lib/categories';

// ── physics ───────────────────────────────────────────────────────────────────
const SPRING_OPEN  = { type: 'spring' as const, stiffness: 380, damping: 30, mass: 1 };
const SPRING_CLOSE = { type: 'spring' as const, stiffness: 440, damping: 36, mass: 1 };

// ── geometry ──────────────────────────────────────────────────────────────────
const PILL_H     = 48;   // collapsed height px
const EXPANDED_H = 268;  // expanded height px
const HEADER_H   = 40;   // drag-handle strip height
const THRESHOLD  = 0.30;
const VEL_OPEN   =  380;
const VEL_CLOSE  = -380;

type IslandState = 'collapsed' | 'expanded' | 'parsing' | 'reviewing' | 'saving' | 'success';

// ── helpers ───────────────────────────────────────────────────────────────────
function rubberBand(x: number): number {
  if (x >= 0 && x <= 1) return x;
  if (x > 1) { const e = x - 1; return 1 + 0.25 * (1 - 1 / (e * 4 + 1)); }
  const e = -x; return -(0.25 * (1 - 1 / (e * 4 + 1)));
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp01(v: number)                    { return Math.max(0, Math.min(1, v)); }

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── component ─────────────────────────────────────────────────────────────────
export function QuickAddIsland() {
  const router = useRouter();

  // Hidden file inputs
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const textRef   = useRef<HTMLTextAreaElement>(null);

  // progress 0→1: single motion value drives ALL geometry
  const progress = useMotionValue(0);

  // ── geometry transforms ────────────────────────────────────────────────────
  // Height: pill → panel
  const panelH = useTransform(progress, (p) => lerp(PILL_H, EXPANDED_H, clamp01(p)));

  // Organic shape: top corners stay 20px; bottom corners 12→24px (relaxes as panel grows)
  // This gives the collapsed bar a "docked" feel — connected to content below.
  const radTL = useTransform(progress, (p) => lerp(20, 24, clamp01(p)));
  const radTR = useTransform(progress, (p) => lerp(20, 24, clamp01(p)));
  const radBL = useTransform(progress, (p) => lerp(12, 24, clamp01(p)));
  const radBR = useTransform(progress, (p) => lerp(12, 24, clamp01(p)));

  // Pill content: fades out at 20%
  const pillOp = useTransform(progress, [0, 0.18], [1, 0]);

  // Expanded content: staggered fade-up per section
  const headerOp   = useTransform(progress, [0.28, 0.48], [0, 1]);
  const headerY    = useTransform(progress, [0.28, 0.48], [-4, 0]);
  const inputOp    = useTransform(progress, [0.40, 0.62], [0, 1]);
  const inputY     = useTransform(progress, [0.40, 0.62], [8, 0]);
  const modeOp     = useTransform(progress, [0.55, 0.78], [0, 1]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [state,  setState]  = useState<IslandState>('collapsed');
  const [text,   setText]   = useState('');
  const [draft,  setDraft]  = useState<TransactionDraft | null>(null);
  const isExpanded = state !== 'collapsed';

  useEffect(() => {
    if (state === 'expanded') {
      const t = setTimeout(() => textRef.current?.focus(), 340);
      return () => clearTimeout(t);
    }
  }, [state]);

  // ── spring snaps ───────────────────────────────────────────────────────────
  const openIsland = useCallback(() => {
    setState('expanded');
    animate(progress, 1, SPRING_OPEN);
  }, [progress]);

  const closeIsland = useCallback(() => {
    animate(progress, 0, SPRING_CLOSE).then(() => {
      setState('collapsed');
      setText('');
      setDraft(null);
    });
  }, [progress]);

  // ── drag gesture ───────────────────────────────────────────────────────────
  const dragging = useRef(false);
  const startY   = useRef(0);
  const startP   = useRef(0);
  const prevY    = useRef(0);
  const prevT    = useRef(0);
  const vel      = useRef(0);

  const onDown = useCallback((e: React.PointerEvent) => {
    if (state === 'saving' || state === 'success') return;
    dragging.current = true;
    startY.current   = e.clientY;
    startP.current   = progress.get();
    prevY.current    = e.clientY;
    prevT.current    = e.timeStamp;
    vel.current      = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [state, progress]);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dt = e.timeStamp - prevT.current;
    if (dt > 0) {
      const iv = (e.clientY - prevY.current) / (dt / 1000);
      vel.current = vel.current * 0.6 + iv * 0.4;
    }
    prevY.current = e.clientY;
    prevT.current = e.timeStamp;
    const raw = startP.current + (e.clientY - startY.current) / (EXPANDED_H - PILL_H);
    progress.set(rubberBand(raw));
  }, [progress]);

  const onUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    const p = progress.get();
    const v = vel.current;
    if (state === 'collapsed') {
      const travelPx = Math.abs(p - startP.current) * (EXPANDED_H - PILL_H);
      if (travelPx < 8 || p > THRESHOLD || v > VEL_OPEN) { openIsland(); }
      else { animate(progress, 0, SPRING_CLOSE); }
    } else {
      if (p < 1 - THRESHOLD || v < VEL_CLOSE) { closeIsland(); }
      else { animate(progress, 1, SPRING_OPEN); }
    }
  }, [progress, state, openIsland, closeIsland]);

  // ── AI extraction ──────────────────────────────────────────────────────────
  async function extractText() {
    if (!text.trim()) return;
    setState('parsing');
    const res = await extractDraft({ text: text.trim() });
    if (res.success && res.drafts.length > 0) {
      setDraft(res.drafts[0]);
      setState('reviewing');
    } else {
      setState('expanded');
      toast.error(res.success ? 'Nothing found — try rephrasing.' : res.error);
    }
  }

  async function extractImage(file: File) {
    setState('parsing');
    try {
      const b64 = await fileToBase64(file);
      const res  = await extractDraft({ imageBase64: b64 });
      if (res.success && res.drafts.length > 0) {
        setDraft({ ...res.drafts[0], receiptImage: b64 });
        setState('reviewing');
      } else {
        setState('expanded');
        toast.error(res.success ? 'Nothing found in image.' : res.error);
      }
    } catch {
      setState('expanded');
      toast.error('Could not read image.');
    }
  }

  // ── save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!draft) return;
    setState('saving');
    const res = await saveTransaction({
      amount:        draft.amount ?? 0,
      merchant:      draft.merchant ?? 'Unknown',
      category:      draft.category || DEFAULT_CATEGORY,
      date:          draft.date || toDateInputValue(),
      type:          draft.type || 'expense',
      description:   draft.description || draft.merchant || 'Transaction',
      paymentMethod: draft.paymentMethod || null,
      notes:         null,
      items:         draft.items || null,
      receiptImage:  draft.receiptImage || null,
      needsReview:   draft.needsReview || false,
    });
    if (res.success) {
      setState('success');
      setTimeout(() => { closeIsland(); router.refresh(); }, 900);
    } else {
      setState('reviewing');
      toast.error(res.error || 'Could not save');
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  const today = toDateInputValue();

  return (
    <>
      {/* Hidden file inputs — outside the animated panel so they're never clipped */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={(e) => { if (e.target.files?.[0]) extractImage(e.target.files[0]); e.target.value = ''; }} />
      <input ref={fileRef}   type="file" accept="image/*"
        className="hidden" onChange={(e) => { if (e.target.files?.[0]) extractImage(e.target.files[0]); e.target.value = ''; }} />

      {/*
        One motion.div = one continuous object.
        Full-width within page padding (aligned to page content).
        Organic shape: top corners 20px, bottom corners 12px when collapsed
                       (12→24px as panel opens — bottom "relaxes").
      */}
      <motion.div
        style={{
          height:                  panelH,
          borderTopLeftRadius:     radTL,
          borderTopRightRadius:    radTR,
          borderBottomLeftRadius:  radBL,
          borderBottomRightRadius: radBR,
          background:  'var(--ink)',
          position:    'relative',
          overflow:    'hidden',
          touchAction: 'none',
          userSelect:  'none',
          width:       '100%',
        }}
        className="mt-2 mb-4"
      >
        {/* ── COLLAPSED: compact dark bar ───────────────────────────────── */}
        <motion.div
          className="absolute inset-0 flex items-center px-4 gap-3"
          style={{ opacity: pillOp, pointerEvents: isExpanded ? 'none' : 'auto', cursor: 'pointer' }}
          onPointerDown={!isExpanded ? onDown : undefined}
          onPointerMove={!isExpanded ? onMove : undefined}
          onPointerUp={!isExpanded   ? onUp   : undefined}
          onPointerCancel={!isExpanded ? onUp  : undefined}
        >
          {/* Accent dot — the single color moment in the dark bar */}
          <span className="shrink-0 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
            <span className="text-white text-[10px] font-bold leading-none">+</span>
          </span>
          <span className="flex-1 text-sm font-medium text-paper/40 select-none">
            What did you spend?
          </span>
          {/* Camera shortcut in collapsed state */}
          <button
            className="shrink-0 text-paper/25 active:text-paper/60 transition-colors"
            style={{ pointerEvents: 'auto' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }}
          >
            <Camera className="h-4 w-4" />
          </button>
        </motion.div>

        {/* ── EXPANDED PANEL ────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 flex flex-col"
          style={{ pointerEvents: isExpanded ? 'auto' : 'none' }}
        >
          {/* Drag handle / header */}
          <motion.div
            className="shrink-0 relative flex items-center justify-between px-4 cursor-grab active:cursor-grabbing"
            style={{ height: HEADER_H, opacity: headerOp, y: headerY, touchAction: 'none' }}
            onPointerDown={isExpanded ? onDown : undefined}
            onPointerMove={isExpanded ? onMove : undefined}
            onPointerUp={isExpanded   ? onUp   : undefined}
            onPointerCancel={isExpanded ? onUp  : undefined}
          >
            {/* Pill indicator */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-paper/20 pointer-events-none" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-paper/35 select-none mt-1">
              Quick add
            </span>
            <button
              onClick={closeIsland}
              className="p-1 -mr-1 text-paper/35 hover:text-paper/70 transition-colors mt-1"
              style={{ touchAction: 'auto' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>

          {/* ── INPUT state ── */}
          {(state === 'expanded') && (
            <motion.div
              className="flex flex-col flex-1 px-4 pb-4"
              style={{ opacity: inputOp, y: inputY }}
            >
              {/* Natural language text area */}
              <div className="flex items-start gap-2 flex-1">
                <textarea
                  ref={textRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
                      e.preventDefault();
                      extractText();
                    }
                  }}
                  placeholder={'Target 43.28 home supplies\nLunch $28.50\nCostco 86 groceries'}
                  rows={3}
                  className="flex-1 bg-transparent outline-none text-paper text-sm font-medium placeholder:text-paper/20 resize-none leading-relaxed"
                  style={{ touchAction: 'pan-y' }}
                />
                {text.trim() && (
                  <motion.button
                    onClick={extractText}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center active:scale-90 transition-transform mt-0.5"
                  >
                    <ArrowUp className="h-4 w-4 text-white" />
                  </motion.button>
                )}
              </div>

              {/* Input mode row */}
              <motion.div
                className="flex gap-4 mt-1"
                style={{ opacity: modeOp }}
              >
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="flex items-center gap-1.5 text-paper/35 hover:text-paper/60 transition-colors active:text-paper"
                  style={{ touchAction: 'auto' }}
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">Photo</span>
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 text-paper/35 hover:text-paper/60 transition-colors active:text-paper"
                  style={{ touchAction: 'auto' }}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">Receipt</span>
                </button>
                <button
                  onClick={() => router.push('/add')}
                  className="flex items-center gap-1.5 text-paper/35 hover:text-paper/60 transition-colors active:text-paper"
                  style={{ touchAction: 'auto' }}
                >
                  <PenLine className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">Manual</span>
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ── PARSING state ── */}
          {state === 'parsing' && (
            <div className="flex-1 flex items-center justify-center gap-3">
              <Loader2 className="h-4 w-4 text-paper/40 animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-paper/30">
                Reading…
              </span>
            </div>
          )}

          {/* ── REVIEWING / SAVING / SUCCESS states ── */}
          {(state === 'reviewing' || state === 'saving' || state === 'success') && draft && (
            <motion.div
              className="flex flex-col flex-1 px-4 pb-4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {/* Parsed amount — hero number */}
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-[3.25rem] font-bold tracking-tighter text-paper tabular-nums leading-none mb-3">
                  {draft.amount != null
                    ? `$${draft.amount % 1 === 0 ? draft.amount.toFixed(0) : draft.amount.toFixed(2)}`
                    : '—'}
                </p>
                {/* Metadata row: MERCHANT · CATEGORY · ACCOUNT · DATE */}
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  {[
                    draft.merchant?.toUpperCase(),
                    draft.category?.toUpperCase(),
                    draft.paymentMethod?.toUpperCase(),
                    draft.date === today ? 'TODAY' : draft.date,
                  ].filter(Boolean).map((item, i, arr) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold tracking-widest text-paper/60">{item}</span>
                      {i < arr.length - 1 && <span className="text-paper/20 text-[9px]">·</span>}
                    </span>
                  ))}
                  {draft.needsReview && (
                    <span className="ml-1 text-[9px] font-bold tracking-widest text-accent/70 uppercase">
                      · Needs review
                    </span>
                  )}
                </div>
              </div>

              {/* Action row */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setState('expanded'); setDraft(null); setText(draft.rawInput ?? ''); }}
                  className="flex-1 h-9 rounded-xl text-paper/50 text-[10px] font-bold uppercase tracking-widest transition-colors hover:text-paper/80"
                  style={{ background: 'rgba(255,255,255,0.07)' }}
                >
                  Edit
                </button>
                <button
                  onClick={handleSave}
                  disabled={state === 'saving' || state === 'success'}
                  className="flex-1 h-9 rounded-xl bg-accent text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center transition-all active:scale-[0.97] disabled:opacity-60"
                >
                  {state === 'saving'  ? <Loader2 className="h-4 w-4 animate-spin" /> :
                   state === 'success' ? <Check   className="h-4 w-4" />             :
                   'Save'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </>
  );
}
