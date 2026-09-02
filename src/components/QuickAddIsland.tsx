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

// ── physics (calibrated from BottomSheet / SwiftUI hero studies) ─────────────
// Open: snappy spring with slight overshoot
const SPRING_OPEN  = { type: 'spring' as const, stiffness: 380, damping: 30, mass: 1 };
// Close: stiffer, decisive
const SPRING_CLOSE = { type: 'spring' as const, stiffness: 440, damping: 36, mass: 1 };

// ── geometry ──────────────────────────────────────────────────────────────────
const PILL_W   = 108;
const PILL_H   = 36;
const PANEL_H  = 460;
const HEADER_H = 48;

// ── thresholds (BottomSheet: 0.30 dismiss, dead zone before that) ─────────────
const THRESHOLD = 0.30;
const VEL_OPEN  =  380; // px/s downward flick → snap open
const VEL_CLOSE = -380; // px/s upward flick  → snap closed

type UIState = 'collapsed' | 'expanded' | 'saving' | 'success';

// iOS asymptotic rubber-band: maximum overdrag approaches a fixed ceiling
// x: normalized progress value possibly outside [0,1]
function rubberBand(x: number): number {
  if (x >= 0 && x <= 1) return x;
  if (x > 1) {
    const excess = x - 1;
    return 1 + 0.25 * (1 - 1 / (excess * 4 + 1));
  }
  const excess = -x;
  return -(0.25 * (1 - 1 / (excess * 4 + 1)));
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp01(v: number)                     { return Math.max(0, Math.min(1, v)); }

// ─────────────────────────────────────────────────────────────────────────────
export function QuickAddIsland() {
  const router = useRouter();

  // Measure available width on mount / resize
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

  // ── single progress value drives ALL geometry (SwiftUI matched-geometry pattern) ──
  // 0 = pill, 1 = fully expanded panel
  const progress = useMotionValue(0);

  // Panel shell — all derived from the same progress so it morphs as one object
  const panelWidth  = useTransform(progress, (p) => lerp(PILL_W, expandedW, clamp01(p)));
  const panelHeight = useTransform(progress, (p) => lerp(PILL_H, PANEL_H,   clamp01(p)));

  // Radius: ease-out so the "pill identity" dissolves quickly at the start of drag
  const radius = useTransform(progress, (p) => {
    const eased = 1 - (1 - clamp01(p)) ** 2;
    return lerp(9999, 24, eased);
  });

  // Pill label: out by 20%
  const pillOp = useTransform(progress, [0, 0.20], [1, 0]);

  // ── staggered content reveal (SwiftAnimPlayground pattern) ───────────────────
  // Each layer has an offset input window on the same [0,1] progress axis.
  // During drag the reveals flow naturally; spring settle after release feels alive.
  const headerOp   = useTransform(progress, [0.30, 0.52], [0, 1]);
  const headerY    = useTransform(progress, [0.30, 0.52], [-6, 0]);
  const amountOp   = useTransform(progress, [0.42, 0.62], [0, 1]);
  const amountY    = useTransform(progress, [0.42, 0.62], [10, 0]);
  const merchantOp = useTransform(progress, [0.52, 0.70], [0, 1]);
  const merchantY  = useTransform(progress, [0.52, 0.70], [8,  0]);
  const chipsOp    = useTransform(progress, [0.62, 0.80], [0, 1]);
  const chipsY     = useTransform(progress, [0.62, 0.80], [6,  0]);
  const saveOp     = useTransform(progress, [0.72, 0.90], [0, 1]);
  const saveY      = useTransform(progress, [0.72, 0.90], [6,  0]);

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
      const t = setTimeout(() => amountRef.current?.focus(), 340);
      return () => clearTimeout(t);
    }
  }, [uiState]);

  // ── spring snaps ──────────────────────────────────────────────────────────
  const openIsland = useCallback(() => {
    setUiState('expanded');
    animate(progress, 1, SPRING_OPEN);
  }, [progress]);

  const closeIsland = useCallback(() => {
    animate(progress, 0, SPRING_CLOSE).then(() => {
      setUiState('collapsed');
      setAmount('');
      setMerchant('');
      setCategory(DEFAULT_CATEGORY);
      setPaymentMethod('');
    });
  }, [progress]);

  // ── drag gesture ──────────────────────────────────────────────────────────
  // Direct manipulation: geometry follows finger CONTINUOUSLY.
  // Spring fires only AFTER release.
  const dragging = useRef(false);
  const startY   = useRef(0);
  const startP   = useRef(0);
  const prevY    = useRef(0);
  const prevT    = useRef(0);
  const vel      = useRef(0); // px/s, positive = downward

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

    // Velocity (exponential moving average for stability)
    const dt = e.timeStamp - prevT.current;
    if (dt > 0) {
      const instantV = (e.clientY - prevY.current) / (dt / 1000);
      vel.current = vel.current * 0.6 + instantV * 0.4; // EMA smoothing
    }
    prevY.current = e.clientY;
    prevT.current = e.timeStamp;

    // Map drag delta → progress, then apply rubber-band beyond [0,1]
    const dy  = e.clientY - startY.current;
    const raw = startP.current + dy / (PANEL_H - PILL_H);
    progress.set(rubberBand(raw)); // direct, no spring
  }, [progress]);

  const onUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

    const p = progress.get();
    const v = vel.current;

    if (uiState === 'collapsed') {
      // tap = < 8px travel → open
      const travelPx = Math.abs(p - startP.current) * (PANEL_H - PILL_H);
      if (travelPx < 8 || p > THRESHOLD || v > VEL_OPEN) {
        openIsland();
      } else {
        animate(progress, 0, SPRING_CLOSE);
      }
    } else {
      // from expanded: drag up past threshold or fast flick → close
      if (p < 1 - THRESHOLD || v < VEL_CLOSE) {
        closeIsland();
      } else {
        animate(progress, 1, SPRING_OPEN);
      }
    }
  }, [progress, uiState, openIsland, closeIsland]);

  // ── save ──────────────────────────────────────────────────────────────────
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

  const chip       = 'shrink-0 h-7 px-3 rounded-full text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors';
  const isExpanded = uiState !== 'collapsed';

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} className="flex justify-center mt-3 mb-1">
      {/*
        One motion.div = one continuous object.
        motion values in `style` are managed outside React's render cycle,
        so state changes (setUiState) never reset animated dimensions.
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
        {/* ── COLLAPSED PILL LAYER ─────────────────────────────────────────── */}
        {/* Drag and tap target when collapsed */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center cursor-pointer text-paper"
          style={{ opacity: pillOp, pointerEvents: isExpanded ? 'none' : 'auto' }}
          onPointerDown={!isExpanded ? onDown : undefined}
          onPointerMove={!isExpanded ? onMove : undefined}
          onPointerUp={!isExpanded   ? onUp   : undefined}
          onPointerCancel={!isExpanded ? onUp : undefined}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest select-none">
            + Add
          </span>
        </motion.div>

        {/* ── EXPANDED PANEL CONTENT ───────────────────────────────────────── */}
        {/* pointerEvents disabled while collapsed so pill layer handles gestures cleanly */}
        <div
          className="absolute inset-0 flex flex-col"
          style={{ pointerEvents: isExpanded ? 'auto' : 'none' }}
        >
          {/* Header — also the drag handle when expanded */}
          <motion.div
            className="shrink-0 flex items-center justify-between px-5 relative cursor-grab active:cursor-grabbing"
            style={{ height: HEADER_H, opacity: headerOp, y: headerY, touchAction: 'none' }}
            onPointerDown={isExpanded ? onDown : undefined}
            onPointerMove={isExpanded ? onMove : undefined}
            onPointerUp={isExpanded   ? onUp   : undefined}
            onPointerCancel={isExpanded ? onUp  : undefined}
          >
            {/* Drag indicator bar */}
            <div className="absolute left-0 right-0 top-2.5 mx-auto w-8 h-0.5 rounded-full bg-paper/20 pointer-events-none" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-paper/50 select-none">
              Quick add
            </span>
            <button
              onClick={closeIsland}
              className="p-1 -mr-1 text-paper/50 hover:text-paper transition-colors"
              style={{ touchAction: 'auto' }}
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>

          {/* Scrollable form — staggered reveal per section */}
          <div className="flex-1 overflow-y-auto px-5 pb-5" style={{ touchAction: 'pan-y' }}>

            {/* Amount — appears first */}
            <motion.div
              className="flex items-end gap-1 mb-5"
              style={{ opacity: amountOp, y: amountY }}
            >
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
            </motion.div>

            {/* Merchant — second */}
            <motion.div className="mb-4" style={{ opacity: merchantOp, y: merchantY }}>
              <input
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSave) handleSave(); }}
                placeholder="Where?"
                className="w-full text-base font-medium rounded-xl px-4 h-11 outline-none placeholder:text-paper/30 text-paper"
                style={{ background: 'rgba(255,255,255,0.1)', touchAction: 'auto' }}
              />
            </motion.div>

            {/* Chips — third (category + payment method together) */}
            <motion.div style={{ opacity: chipsOp, y: chipsY }}>
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
            </motion.div>

            {/* Save — last to appear */}
            <motion.div style={{ opacity: saveOp, y: saveY }}>
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
            </motion.div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}
