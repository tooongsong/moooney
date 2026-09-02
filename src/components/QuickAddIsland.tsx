'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, Camera, Check, ChevronRight, ImagePlus, Loader2, PenLine, Plus, Settings2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { toDateInputValue } from '@/lib/utils';
import { extractDraft, saveTransaction, type TransactionDraft } from '@/app/actions/transactions';
import { DEFAULT_CATEGORY } from '@/lib/categories';
import type { TransactionType } from '@/lib/categories';
import { getAllCategories, addCustomCategory, getPaymentMethodNames } from '@/app/actions/manage';
import { ResponsiveAmount } from '@/components/ResponsiveAmount';

// ── physics ───────────────────────────────────────────────────────────────────
const SPRING_OPEN  = { type: 'spring' as const, stiffness: 380, damping: 30, mass: 1 };
const SPRING_CLOSE = { type: 'spring' as const, stiffness: 440, damping: 36, mass: 1 };

// ── geometry ──────────────────────────────────────────────────────────────────
const PILL_W     = 108;  // collapsed pill width px
const PILL_H     = 32;   // collapsed pill height px
const EXPANDED_H = 272;  // input/review panel height px
const EDIT_H     = 340;  // editing form height px
const HEADER_H   = 40;
const THRESHOLD  = 0.28;
const VEL_OPEN   =  380;
const VEL_CLOSE  = -380;

type IslandState = 'collapsed' | 'expanded' | 'parsing' | 'reviewing' | 'editing' | 'saving' | 'success';

function rubberBand(x: number): number {
  if (x >= 0 && x <= 1) return x;
  if (x > 1) { const e = x - 1; return 1 + 0.25 * (1 - 1 / (e * 4 + 1)); }
  const e = -x; return -(0.25 * (1 - 1 / (e * 4 + 1)));
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
// Cubic ease-out: fast start, decelerates
function easeOut3(t: number) { return 1 - Math.pow(1 - clamp01(t), 3); }
// Smoothstep: slow start, fast middle, slow end
function smoothstep(t: number) { const c = clamp01(t); return c * c * (3 - 2 * c); }
// Capsule-tracking radius: stays near height/2 (oval feel) then blends to settled panel radius.
// dStart/dEnd are tiny per-corner offsets for organic asymmetry.
function morphRad(q: number, targetH: number, dStart: number, dEnd: number): number {
  const ht    = smoothstep(clamp01((q - 0.08) / 0.92));   // height progress (lags drag)
  const curH  = lerp(PILL_H, targetH, ht);
  const blend = easeOut3(clamp01((q - 0.20) / 0.80));     // blend capsule→panel
  return lerp(curH / 2 + dStart, 22 + dEnd, blend);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface QuickAddIslandProps {
  month?: string;      // e.g. "SEP 26" — shown left of pill when collapsed
  manageHref?: string; // e.g. "/manage" — gear icon right of pill when collapsed
}

export function QuickAddIsland({ month, manageHref }: QuickAddIslandProps) {
  const router = useRouter();

  // Measure inner row width for full-width expanded state
  const rowRef       = useRef<HTMLDivElement>(null);
  const expandedWRef = useRef(340);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    expandedWRef.current = el.offsetWidth;
    const ro = new ResizeObserver(() => { expandedWRef.current = el.offsetWidth; });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const textRef   = useRef<HTMLTextAreaElement>(null);

  const progress = useMotionValue(0);
  // Target expanded height — changes between EXPANDED_H and EDIT_H
  const targetHRef = useRef(EXPANDED_H);

  // Width LEADS: full-width reached at ~55% of drag via easeOut3
  // This makes the shape widen before it tallens — organic blob phase
  const islandW = useTransform(progress, (p) =>
    lerp(PILL_W, expandedWRef.current, easeOut3(clamp01(p) / 0.55))
  );
  // Height LAGS: starts at 8% of drag, eases through smoothstep
  const islandH = useTransform(progress, (p) =>
    lerp(PILL_H, targetHRef.current, smoothstep(clamp01((clamp01(p) - 0.08) / 0.92)))
  );

  // Capsule-tracking radii: each corner stays near h/2 (oval) then blends to panel radius.
  // This creates the Dynamic Island-style "fat oval → rounded rect" morph continuously.
  // targetHRef.current is read live each frame — safe because it's a ref, not state.
  const radTL = useTransform(progress, (p) => morphRad(clamp01(p), targetHRef.current,  0,  0));
  const radTR = useTransform(progress, (p) => morphRad(clamp01(p), targetHRef.current,  1,  0));
  const radBL = useTransform(progress, (p) => morphRad(clamp01(p), targetHRef.current, -1,  2));
  const radBR = useTransform(progress, (p) => morphRad(clamp01(p), targetHRef.current,  0,  2));

  // Pill icon fades very fast — shape transcends pill quickly
  const pillOp = useTransform(progress, [0, 0.14], [1, 0]);
  const sideOp = useTransform(progress, [0, 0.16], [1, 0]);

  // Content appears late — panel must be mostly formed before revealing
  // At 52% drag: width=full, height=65% → fat squircle shape, header starts
  // At 62% drag: height=75%, input starts to reveal
  // At 72% drag: height=85%, mode buttons appear
  const headerOp = useTransform(progress, [0.52, 0.70], [0, 1]);
  const headerY  = useTransform(progress, [0.52, 0.70], [-6, 0]);
  const inputOp  = useTransform(progress, [0.62, 0.80], [0, 1]);
  const inputY   = useTransform(progress, [0.62, 0.80], [ 8, 0]);
  const modeOp   = useTransform(progress, [0.72, 0.90], [0, 1]);

  const [state, setState] = useState<IslandState>('collapsed');
  const [text,  setText]  = useState('');
  const [draft, setDraft] = useState<TransactionDraft | null>(null);
  const isExpanded = state !== 'collapsed';

  // Edit form state
  const [editAmount,   setEditAmount]   = useState('');
  const [editMerchant, setEditMerchant] = useState('');
  const [editCategory, setEditCategory] = useState<string>(DEFAULT_CATEGORY);
  const [editDate,     setEditDate]     = useState('');
  const [editType,     setEditType]     = useState<TransactionType>('expense');
  const [editAccount,  setEditAccount]  = useState('');

  // Dynamic lists for edit form
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [accountNames,  setAccountNames]  = useState<string[]>([]);
  const [isAddingCat,   setIsAddingCat]   = useState(false);
  const [newCatName,    setNewCatName]    = useState('');

  async function submitNewCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const res = await addCustomCategory(name);
    if (res.success) {
      setAllCategories((prev) => [...prev, name].sort());
      setEditCategory(name);
      setIsAddingCat(false);
      setNewCatName('');
    } else {
      toast.error(res.error || 'Could not add category');
    }
  }

  function enterEditing(d: TransactionDraft) {
    setEditAmount(d.amount != null ? String(d.amount) : '');
    setEditMerchant(d.merchant ?? '');
    setEditCategory(d.category ?? DEFAULT_CATEGORY);
    setEditDate(d.date ?? toDateInputValue());
    setEditType(d.type ?? 'expense');
    setEditAccount(d.paymentMethod ?? '');
    setIsAddingCat(false);
    setNewCatName('');
    targetHRef.current = EDIT_H;
    animate(progress, 1, SPRING_OPEN);
    setState('editing');
    // Fetch fresh lists in background
    getAllCategories().then(setAllCategories);
    getPaymentMethodNames().then(setAccountNames);
  }

  function applyEdit() {
    if (!draft) return;
    const amount = parseFloat(editAmount);
    setDraft({
      ...draft,
      amount:        Number.isFinite(amount) ? amount : draft.amount,
      merchant:      editMerchant || draft.merchant,
      category:      editCategory,
      date:          editDate || draft.date,
      type:          editType,
      paymentMethod: editAccount || draft.paymentMethod,
    });
    targetHRef.current = EXPANDED_H;
    animate(progress, 1, SPRING_OPEN);
    setState('reviewing');
  }

  useEffect(() => {
    if (state === 'expanded') {
      const t = setTimeout(() => textRef.current?.focus(), 340);
      return () => clearTimeout(t);
    }
  }, [state]);

  const openIsland = useCallback(() => {
    setState('expanded');
    animate(progress, 1, SPRING_OPEN);
  }, [progress]);

  const closeIsland = useCallback(() => {
    targetHRef.current = EXPANDED_H;
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
      toast.error(res.success ? 'Nothing found — try rephrasing.' : 'Recognition failed. Try again or enter manually.');
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
        toast.error(res.success ? 'Nothing found in image.' : 'Could not read image. Try a clearer photo or enter manually.');
      }
    } catch {
      setState('expanded');
      toast.error('Photo failed to load. Try again.');
    }
  }

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

  const today = toDateInputValue();

  return (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={(e) => { if (e.target.files?.[0]) extractImage(e.target.files[0]); e.target.value = ''; }} />
      <input ref={fileRef} type="file" accept="image/*"
        className="hidden" onChange={(e) => { if (e.target.files?.[0]) extractImage(e.target.files[0]); e.target.value = ''; }} />

      {/*
        Sticky container: full-bleed, covers safe-area, IS the page header.
        bg-paper ensures content scrolling under looks clean.
      */}
      <div
        className="sticky top-0 z-40 -mx-6 px-6 bg-paper"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/*
          Inner row: flex justify-center so the pill stays horizontally centered
          and blooms outward symmetrically as it expands.
          Month/manage are absolute-positioned in this row.
        */}
        <div
          ref={rowRef}
          className="relative py-2 flex items-center justify-center"
        >
          {/* Month label — far left, fades as island expands */}
          {month && (
            <motion.div
              className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none select-none"
              style={{ opacity: sideOp }}
            >
              <span className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">
                {month}
              </span>
            </motion.div>
          )}

          {/* ── THE ISLAND ── */}
          <motion.div
            style={{
              width:                   islandW,
              height:                  islandH,
              borderTopLeftRadius:     radTL,
              borderTopRightRadius:    radTR,
              borderBottomLeftRadius:  radBL,
              borderBottomRightRadius: radBR,
              background:   'var(--ink)',
              position:     'relative',
              overflow:     'hidden',
              touchAction:  'none',
              userSelect:   'none',
            }}
          >
            {/* ── COLLAPSED: pill ───────────────────────────────────────── */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              style={{ opacity: pillOp, pointerEvents: isExpanded ? 'none' : 'auto' }}
              onPointerDown={!isExpanded ? onDown : undefined}
              onPointerMove={!isExpanded ? onMove : undefined}
              onPointerUp={!isExpanded   ? onUp   : undefined}
              onPointerCancel={!isExpanded ? onUp  : undefined}
            >
              <span className="w-[18px] h-[18px] rounded-full bg-accent flex items-center justify-center shrink-0">
                <Plus className="w-[10px] h-[10px] text-white stroke-[2.5]" />
              </span>
            </motion.div>

            {/* ── EXPANDED PANEL ────────────────────────────────────────── */}
            <div
              className="absolute inset-0 flex flex-col"
              style={{ pointerEvents: isExpanded ? 'auto' : 'none' }}
            >
              {/* Drag handle */}
              <motion.div
                className="shrink-0 relative flex items-center justify-between px-4 cursor-grab active:cursor-grabbing"
                style={{ height: HEADER_H, opacity: headerOp, y: headerY, touchAction: 'none' }}
                onPointerDown={isExpanded ? onDown : undefined}
                onPointerMove={isExpanded ? onMove : undefined}
                onPointerUp={isExpanded   ? onUp   : undefined}
                onPointerCancel={isExpanded ? onUp  : undefined}
              >
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

              {/* INPUT state */}
              {state === 'expanded' && (
                <motion.div
                  className="flex flex-col flex-1 px-4 pb-4"
                  style={{ opacity: inputOp, y: inputY }}
                >
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

                  <motion.div className="flex gap-4 mt-1" style={{ opacity: modeOp }}>
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

              {/* PARSING state */}
              {state === 'parsing' && (
                <div className="flex-1 flex items-center justify-center gap-3">
                  <Loader2 className="h-4 w-4 text-paper/40 animate-spin" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-paper/30">Reading…</span>
                </div>
              )}

              {/* REVIEWING / SAVING / SUCCESS states */}
              {(state === 'reviewing' || state === 'saving' || state === 'success') && draft && (
                <motion.div
                  className="flex flex-col flex-1 px-4 pb-4"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <div className="flex-1 flex flex-col justify-center">
                    {draft.amount != null ? (
                      <ResponsiveAmount
                        value={draft.amount}
                        baseSize={52}
                        minSize={22}
                        spanClassName="text-paper"
                        format={(v) => `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}`}
                        className="mb-3"
                      />
                    ) : (
                      <p className="text-[3.25rem] font-bold tracking-tighter text-paper tabular-nums leading-none mb-3">—</p>
                    )}
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
                        <span className="ml-1 text-[9px] font-bold tracking-widest text-accent/70 uppercase">· Needs review</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => enterEditing(draft)}
                      className="flex-1 h-9 rounded-xl text-paper/50 text-[10px] font-bold uppercase tracking-widest transition-colors hover:text-paper/80 active:scale-[0.97]"
                      style={{ background: 'rgba(255,255,255,0.07)', touchAction: 'auto' }}
                    >
                      Edit
                    </button>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={handleSave}
                      disabled={state === 'saving' || state === 'success'}
                      className="flex-1 h-9 rounded-xl bg-accent text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center transition-all active:scale-[0.97] disabled:opacity-60"
                      style={{ touchAction: 'auto' }}
                    >
                      {state === 'saving'  ? <Loader2 className="h-4 w-4 animate-spin" /> :
                       state === 'success' ? <Check   className="h-4 w-4" />             :
                       'Save'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* EDITING state — inline form */}
              {state === 'editing' && draft && (
                <motion.div
                  className="flex flex-col flex-1 px-4 pb-4 overflow-y-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18 }}
                  style={{ touchAction: 'pan-y' }}
                >
                  {/* Amount */}
                  <div className="mb-3">
                    <label className="block text-[8px] font-bold uppercase tracking-widest text-paper/30 mb-1">Amount</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full bg-transparent outline-none text-paper text-xl font-bold tabular-nums placeholder:text-paper/20 border-b border-paper/10 pb-1"
                      placeholder="0.00"
                      style={{ touchAction: 'auto' }}
                    />
                  </div>
                  {/* Merchant */}
                  <div className="mb-3">
                    <label className="block text-[8px] font-bold uppercase tracking-widest text-paper/30 mb-1">Merchant</label>
                    <input
                      type="text"
                      value={editMerchant}
                      onChange={(e) => setEditMerchant(e.target.value)}
                      className="w-full bg-transparent outline-none text-paper text-sm font-medium placeholder:text-paper/20 border-b border-paper/10 pb-1"
                      placeholder="Where did you spend?"
                      style={{ touchAction: 'auto' }}
                    />
                  </div>
                  {/* Category + Type row */}
                  <div className="flex gap-3 mb-3">
                    <div className="flex-1">
                      <label className="block text-[8px] font-bold uppercase tracking-widest text-paper/30 mb-1">Category</label>
                      <select
                        value={isAddingCat ? '__add__' : editCategory}
                        onChange={(e) => {
                          if (e.target.value === '__add__') { setIsAddingCat(true); }
                          else { setEditCategory(e.target.value); setIsAddingCat(false); }
                        }}
                        className="w-full bg-transparent outline-none text-paper text-xs font-medium border-b border-paper/10 pb-1 appearance-none"
                        style={{ touchAction: 'auto' }}
                      >
                        {allCategories.map((c) => (
                          <option key={c} value={c} className="text-ink bg-paper">{c}</option>
                        ))}
                        <option value="__add__" className="text-ink bg-paper">+ Add category</option>
                      </select>
                      {isAddingCat && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <input
                            autoFocus
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitNewCategory();
                              if (e.key === 'Escape') { setIsAddingCat(false); setNewCatName(''); }
                            }}
                            placeholder="New category"
                            className="flex-1 bg-transparent outline-none text-paper text-xs font-medium placeholder:text-paper/20 border-b border-paper/10 pb-1"
                            style={{ touchAction: 'auto' }}
                          />
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={submitNewCategory}
                            disabled={!newCatName.trim()}
                            className="text-accent text-[9px] font-bold uppercase tracking-wide disabled:opacity-40"
                            style={{ touchAction: 'auto' }}
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="block text-[8px] font-bold uppercase tracking-widest text-paper/30 mb-1">Type</label>
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as TransactionType)}
                        className="w-full bg-transparent outline-none text-paper text-xs font-medium border-b border-paper/10 pb-1 appearance-none"
                        style={{ touchAction: 'auto' }}
                      >
                        <option value="expense" className="text-ink bg-paper">Expense</option>
                        <option value="income"  className="text-ink bg-paper">Income</option>
                        <option value="refund"  className="text-ink bg-paper">Refund</option>
                      </select>
                    </div>
                  </div>
                  {/* Date + Account row */}
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1">
                      <label className="block text-[8px] font-bold uppercase tracking-widest text-paper/30 mb-1">Date</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full bg-transparent outline-none text-paper text-xs font-medium border-b border-paper/10 pb-1"
                        style={{ colorScheme: 'dark', touchAction: 'auto' }}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[8px] font-bold uppercase tracking-widest text-paper/30 mb-1">Account</label>
                      <select
                        value={editAccount}
                        onChange={(e) => setEditAccount(e.target.value)}
                        className="w-full bg-transparent outline-none text-paper text-xs font-medium border-b border-paper/10 pb-1 appearance-none"
                        style={{ touchAction: 'auto' }}
                      >
                        <option value="" className="text-ink bg-paper">None</option>
                        {accountNames.map((a) => (
                          <option key={a} value={a} className="text-ink bg-paper">{a}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* Cancel / Update */}
                  <div className="flex gap-2 mt-auto shrink-0">
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => { targetHRef.current = EXPANDED_H; animate(progress, 1, SPRING_OPEN); setState('reviewing'); }}
                      className="flex-1 h-9 rounded-xl text-paper/50 text-[10px] font-bold uppercase tracking-widest active:scale-[0.97] transition-transform"
                      style={{ background: 'rgba(255,255,255,0.07)', touchAction: 'auto' }}
                    >
                      Cancel
                    </button>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={applyEdit}
                      className="flex-1 h-9 rounded-xl bg-paper/10 text-paper text-[10px] font-bold uppercase tracking-widest active:scale-[0.97] transition-transform"
                      style={{ touchAction: 'auto' }}
                    >
                      Update
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Manage icon — far right, fades as island expands */}
          {manageHref && (
            <motion.div
              className="absolute right-0 top-1/2 -translate-y-1/2"
              style={{ opacity: sideOp, pointerEvents: isExpanded ? 'none' : 'auto' }}
            >
              <Link
                href={manageHref}
                className="flex items-center justify-center p-1.5 -mr-1.5 text-ink-faint hover:text-ink transition-colors"
              >
                <Settings2 className="h-[15px] w-[15px]" />
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}
