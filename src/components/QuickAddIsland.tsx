'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { cn, toDateInputValue } from '@/lib/utils';
import { saveTransaction } from '@/app/actions/transactions';
import { getAllCategories, getPaymentMethodNames } from '@/app/actions/manage';
import { DEFAULT_CATEGORY } from '@/lib/categories';

// ── spring configs ──────────────────────────────────────────────────────────
const OPEN_SPRING  = { type: 'spring' as const, stiffness: 360, damping: 30, mass: 1 };
const CLOSE_SPRING = { type: 'spring' as const, stiffness: 420, damping: 38, mass: 1 };

const PILL_W    = 108;
const PILL_H    = 36;
const PANEL_H   = 460;
const HEADER_H  = 48;
const THRESHOLD = 0.35;
const VEL_OPEN  =  450;  // px/s downward
const VEL_CLOSE = -450;  // px/s upward

type UIState = 'collapsed' | 'expanded' | 'saving' | 'success';

// ── component ───────────────────────────────────────────────────────────────
export function QuickAddIsland() {
  const router = useRouter();

  // Measure wrapper so expanded panel fills available width
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [expandedW, setExpandedW] = useState(360);
  useEffect(() => {
    const measure = () => {
      if (wrapperRef.current) setExpandedW(Math.min(wrapperRef.current.offsetWidth, 400));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  // progress: 0 = collapsed, 1 = expanded
  // motion.div reads motion values directly — immune to React re-renders
  const progress    = useMotionValue(0);
  const panelWidth  = useTransform(progress, (p) => lerp(PILL_W, expandedW, clamp01(p)));
  const panelHeight = useTransform(progress, (p) => lerp(PILL_H, PANEL_H,   clamp01(p)));
  const radius      = useTransform(progress, (p) => lerp(9999,   24,        clamp01(p)));
  const pillOp      = useTransform(progress, [0, 0.20], [1, 0]);
  const contentOp   = useTransform(progress, [0.40, 1], [0, 1]);
  const contentSc   = useTransform(progress, [0.40, 1], [0.92, 1]);

  // ── form state ─────────────────────────────────────────────────────────────
  const [uiState,       setUiState]       = useState<UIState>('collapsed');
  const [amount,        setAmount]        = useState('');
  const [merchant,      setMerchant]      = useState('');
  const [category,      setCategory]      = useState<string>(DEFAULT_CATEGORY);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [categories,    setCategories]    = useState<string[]>([]);
  const [methods,       setMethods]       = useState<string[]>([]);
  const [dataLoaded,    setDataLoaded]    = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (uiState !== 'collapsed' && !dataLoaded) {
      Promise.all([getAllCategories(), getPaymentMethodNames()]).then(([cats, meths]) => {
        setCategories(cats);
        setMethods(meths);
        if (meths.length === 1) setPaymentMethod(meths[0]);
        setDataLoaded(true);
      });
    }
  }, [uiState, dataLoaded]);

  useEffect(() => {
    if (uiState === 'expanded') {
      const t = setTimeout(() => amountRef.current?.focus(), 320);
      return () => clearTimeout(t);
    }
  }, [uiState]);

  // ── spring snaps ────────────────────────────────────────────────────────────
  const openIsland = useCallback(() => {
    setUiState('expanded');
    animate(progress, 1, OPEN_SPRING);
  }, [progress]);

  const closeIsland = useCallback(() => {
    animate(progress, 0, CLOSE_SPRING).then(() => {
      setUiState('collapsed');
      setAmount('');
      setMerchant('');
      setCategory(DEFAULT_CATEGORY);
      setPaymentMethod('');
    });
  }, [progress]);

  // ── drag state ──────────────────────────────────────────────────────────────
  const dragging = useRef(false);
  const startY   = useRef(0);
  const startP   = useRef(0);
  const prevY    = useRef(0);
  const prevT    = useRef(0);
  const vel      = useRef(0);

  const onDown = useCallback((e: React.PointerEvent) => {
    if (uiState === 'saving' || uiState === 'success') return;
    dragging.current = true;
    startY.current   = e.clientY;
    startP.current   = progress.get();
    prevY.current    = e.clientY;
    prevT.current    = e.timeStamp;
    vel.current      = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [uiState, progress]);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dt = e.timeStamp - prevT.current;
    if (dt > 0) vel.current = (e.clientY - prevY.current) / (dt / 1000);
    prevY.current = e.clientY;
    prevT.current = e.timeStamp;

    const dy    = e.clientY - startY.current;
    const range = PANEL_H - PILL_H;
    let   raw   = startP.current + dy / range;

    // rubber-band beyond [0, 1]
    if (raw > 1) raw = 1 + (raw - 1) * 0.12;
    if (raw < 0) raw = raw * 0.12;

    progress.set(Math.max(-0.3, Math.min(1.3, raw)));
  }, [progress]);

  const onUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

    const p = progress.get();
    const v = vel.current;

    if (uiState === 'collapsed') {
      // tap (< 8px movement) or drag past threshold → open
      const moved = Math.abs(p) * (PANEL_H - PILL_H);
      if (moved < 8 || p > THRESHOLD || v > VEL_OPEN) { openIsland(); return; }
      animate(progress, 0, CLOSE_SPRING);
    } else {
      // from expanded: significant upward drag → close
      if (p < 1 - THRESHOLD || v < VEL_CLOSE) { closeIsland(); return; }
      animate(progress, 1, OPEN_SPRING);
    }
  }, [progress, uiState, openIsland, closeIsland]);

  // ── save ────────────────────────────────────────────────────────────────────
  const amountNum = parseFloat(amount);
  const canSave   = !isNaN(amountNum) && amountNum > 0 && merchant.trim().length > 0 && uiState === 'expanded';

  async function handleSave() {
    if (!canSave) return;
    setUiState('saving');
    const result = await saveTransaction({
      amount:        amountNum,
      merchant:      merchant.trim(),
      category,
      date:          toDateInputValue(),
      type:          'expense',
      description:   merchant.trim(),
      paymentMethod: paymentMethod || null,
      notes:         null,
      items:         null,
      receiptImage:  null,
      needsReview:   false,
    });
    if (result.success) {
      setUiState('success');
      setTimeout(() => { closeIsland(); router.refresh(); }, 850);
    } else {
      setUiState('expanded');
      toast.error(result.error || 'Could not save');
    }
  }

  const chip = 'shrink-0 h-7 px-3 rounded-full text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors';

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} className="flex justify-center mt-3 mb-1">
      {/*
        motion.div reads motion values from `style` directly —
        React re-renders (e.g. setUiState) do NOT reset animated dimensions.
      */}
      <motion.div
        style={{
          width:        panelWidth,
          height:       panelHeight,
          borderRadius: radius,
          background:   'var(--ink)',
          position:     'relative',
          overflow:     'hidden',
          touchAction:  'none',
          userSelect:   'none',
        }}
      >
        {/* ── Collapsed pill ─────────────────────────────── */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center cursor-pointer text-paper"
          style={{ opacity: pillOp }}
          onPointerDown={uiState === 'collapsed' ? onDown : undefined}
          onPointerMove={uiState === 'collapsed' ? onMove : undefined}
          onPointerUp={uiState   === 'collapsed' ? onUp   : undefined}
          onPointerCancel={uiState === 'collapsed' ? onUp  : undefined}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest select-none">
            + Add
          </span>
        </motion.div>

        {/* ── Expanded panel ─────────────────────────────── */}
        <motion.div
          className="absolute inset-0 flex flex-col"
          style={{
            opacity:         contentOp,
            scale:           contentSc,
            transformOrigin: 'top center',
          }}
        >
          {/* Drag handle / header */}
          <div
            className="shrink-0 flex items-center justify-between px-5 cursor-grab active:cursor-grabbing"
            style={{ height: HEADER_H, touchAction: 'none' }}
            onPointerDown={uiState === 'expanded' ? onDown : undefined}
            onPointerMove={uiState === 'expanded' ? onMove : undefined}
            onPointerUp={uiState   === 'expanded' ? onUp   : undefined}
            onPointerCancel={uiState === 'expanded' ? onUp  : undefined}
          >
            {/* Drag pill indicator */}
            <div className="absolute left-0 right-0 top-2.5 mx-auto w-8 h-0.5 rounded-full bg-paper/20 pointer-events-none" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-paper/50 select-none mt-1">
              Quick add
            </span>
            <button
              onClick={closeIsland}
              className="p-1 -mr-1 text-paper/50 hover:text-paper transition-colors mt-1"
              style={{ touchAction: 'auto' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto px-5 pb-5" style={{ touchAction: 'pan-y' }}>
            {/* Amount */}
            <div className="flex items-end gap-1 mb-5">
              <span className="text-2xl text-paper/30 font-light mb-0.5 leading-none">$</span>
              <input
                ref={amountRef}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSave) handleSave(); }}
                placeholder="0.00"
                className="flex-1 text-5xl font-bold tracking-tighter bg-transparent outline-none placeholder:text-paper/20 text-paper leading-none min-w-0"
                style={{ touchAction: 'auto' }}
              />
            </div>

            {/* Merchant */}
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSave) handleSave(); }}
              placeholder="Where?"
              className="w-full text-base font-medium rounded-xl px-4 h-11 outline-none placeholder:text-paper/30 text-paper mb-4"
              style={{ background: 'rgba(255,255,255,0.1)', touchAction: 'auto' }}
            />

            {/* Category chips */}
            {categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 mb-3" style={{ touchAction: 'pan-x' }}>
                {categories.slice(0, 8).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(chip, category === c ? 'bg-paper text-ink' : 'text-paper/60')}
                    style={category !== c ? { background: 'rgba(255,255,255,0.1)' } : {}}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {/* Payment method chips */}
            {methods.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 mb-5" style={{ touchAction: 'pan-x' }}>
                {methods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(paymentMethod === m ? '' : m)}
                    className={cn(chip, paymentMethod === m ? 'bg-paper text-ink' : 'text-paper/60')}
                    style={paymentMethod !== m ? { background: 'rgba(255,255,255,0.1)' } : {}}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}

            {/* Save */}
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="w-full h-12 rounded-xl bg-accent text-white text-sm font-bold uppercase tracking-widest flex items-center justify-center transition-all active:scale-[0.97] disabled:opacity-30"
            >
              {uiState === 'saving'  ? <Loader2 className="h-5 w-5 animate-spin" /> :
               uiState === 'success' ? <Check   className="h-5 w-5" />             :
               'Save'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ── utils ────────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number)  { return a + (b - a) * t; }
function clamp01(v: number)                      { return Math.max(0, Math.min(1, v)); }
