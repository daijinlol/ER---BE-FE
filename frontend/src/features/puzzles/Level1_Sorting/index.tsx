import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { gameEvents } from '../../../core/EventBus';
import { usePuzzleValidation } from '../../../hooks/usePuzzleValidation';
import { audio } from '../../../core/AudioEngine';
import {
  Lock, Unlock, ArrowLeftRight, ChevronRight,
  Terminal, X, HelpCircle, ChevronDown, ChevronUp
} from 'lucide-react';

// -------------------------------------------------------------------
// Deterministic shuffle using a simple seeded PRNG (Mulberry32)
// -------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffleArray(arr: number[], seed: number): number[] {
  const a = [...arr];
  const rng = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------
const SORTED_VALUES = [5, 17, 29, 42, 61, 83];
const SEED = 2026;
const MAX_VALUE = 83;

// Colour palette for bars
const BAR_COLORS = [
  'from-cyan-500 to-cyan-400',
  'from-blue-500 to-blue-400',
  'from-indigo-500 to-indigo-400',
  'from-violet-500 to-violet-400',
  'from-purple-500 to-purple-400',
  'from-fuchsia-500 to-fuchsia-400',
];

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------
export default function Level1Sorting() {
  const { t } = useTranslation();
  const { validate } = usePuzzleValidation('elem_6', '1');

  // Build initial shuffled array (only on first render)
  const initialArray = useMemo(() => {
    let shuffled = shuffleArray(SORTED_VALUES, SEED);
    // Make sure it's not accidentally sorted already
    while (JSON.stringify(shuffled) === JSON.stringify(SORTED_VALUES)) {
      shuffled = shuffleArray(SORTED_VALUES, SEED + 1);
    }
    return shuffled;
  }, []);

  const [items, setItems] = useState<number[]>(initialArray);
  const [pointer, setPointer] = useState(0);           // comparison index (compare [pointer] vs [pointer+1])
  const [pass, setPass] = useState(1);                  // which pass through the array
  const [totalComparisons, setTotalComparisons] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [sortedCount, setSortedCount] = useState(0);    // how many elements are locked from the right
  const [isSolved, setIsSolved] = useState(false);
  const [swappedInPass, setSwappedInPass] = useState(false);
  const [terminalKey, setTerminalKey] = useState('level1.awaitingSort');
  const [mistakeMsg, setMistakeMsg] = useState<string | null>(null);

  const [hintOpen, setHintOpen] = useState(false);

  // The limit for the current pass — we don't compare already-sorted tail
  const passLimit = items.length - 1 - sortedCount;

  // -------------------------------------------------------------------
  // Core action handler
  // -------------------------------------------------------------------
  const handleAction = useCallback((action: 'SWAP' | 'KEEP') => {
    if (isSolved || mistakeMsg) return;

    const a = items[pointer];
    const b = items[pointer + 1];
    const shouldSwap = a > b;

    // Wrong choice → formative feedback
    if ((action === 'SWAP' && !shouldSwap) || (action === 'KEEP' && shouldSwap)) {
      audio.playDeny();
      setMistakes(prev => prev + 1);
      gameEvents.publish('TIME_PENALTY', { seconds: 30 });

      const key = action === 'SWAP' ? 'level1.mistakeSwap' : 'level1.mistakeKeep';
      setMistakeMsg(t(key, { a, b }));
      setTimeout(() => setMistakeMsg(null), 2200);
      return;
    }

    // Correct choice
    audio.playClick();
    setTotalComparisons(prev => prev + 1);

    if (action === 'SWAP') {
      const newItems = [...items];
      [newItems[pointer], newItems[pointer + 1]] = [newItems[pointer + 1], newItems[pointer]];
      setItems(newItems);
      setSwappedInPass(true);
      setFlashSwap(true);
      setTimeout(() => setFlashSwap(false), 350);
    }

    // Advance pointer
    const nextPointer = pointer + 1;

    if (nextPointer >= passLimit) {
      // End of this pass — the last element is now in its final position
      const newSortedCount = sortedCount + 1;
      setSortedCount(newSortedCount);

      // Check if fully sorted (n-1 elements locked means done)
      if (newSortedCount >= items.length - 1 || (!swappedInPass && action !== 'SWAP')) {
        // Array is sorted — mark all elements as sorted for UI
        setSortedCount(items.length);
        handleSolved();
        return;
      }

      // Start a new pass
      setPass(prev => prev + 1);
      setPointer(0);
      setSwappedInPass(false);
    } else {
      setPointer(nextPointer);
    }
  }, [items, pointer, passLimit, isSolved, sortedCount, swappedInPass, mistakeMsg, t]);

  // -------------------------------------------------------------------
  // Solved handler
  // -------------------------------------------------------------------
  const handleSolved = async () => {
    setIsSolved(true);
    setTerminalKey('level1.sortComplete');
    audio.playSuccess();

    const check = await validate({
      sorted_array: [...items].sort((a, b) => a - b),
      total_comparisons: totalComparisons + 1, // include current
      mistakes,
    });

    if (check.success) {
      setTimeout(() => {
        check.unlocks.forEach((item: string) => {
          gameEvents.publish('ITEM_FOUND', item);
        });
        audio.playItemFound();
        setTerminalKey('level1.tokenGranted');
      }, 1500);

      setTimeout(() => {
        gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 2 });
      }, 3500);
    }
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div
      className="w-full h-full flex flex-col items-center p-4 bg-slate-900 overflow-y-auto relative"
    >
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0%,rgba(15,23,42,1)_100%)] pointer-events-none" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div
        className="w-full z-10 flex flex-col gap-3 cursor-default flex-1"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Terminal Header ─── */}
        <div className="bg-black/50 border border-slate-700/50 rounded-xl p-4 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-4">
              <Terminal className="text-slate-400" />
              <div>
                <h2 className="text-sm font-mono text-slate-200 uppercase tracking-widest">
                  {t('level1.title')}
                </h2>
                <p className="text-xs font-mono text-slate-500 tracking-wider">
                  {t('level1.subtitle')}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                audio.playClick();
                gameEvents.publish('PUZZLE_CLOSED');
              }}
              className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/50"
              title="Close Interface"
            >
              <X size={24} />
            </button>
          </div>
          <p className="font-mono text-xs text-brand-400 border-l-2 border-brand-500 pl-3">
            {t(terminalKey)}
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="inline-block w-2 h-4 bg-brand-400 ml-1 translate-y-1"
            />
          </p>
        </div>

        {/* ─── Hint Panel (collapsible) ─── */}
        <button
          onClick={() => setHintOpen(prev => !prev)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-950/40 border border-indigo-500/30 rounded-lg text-indigo-300 text-xs font-mono tracking-wider hover:bg-indigo-950/60 transition-colors w-full text-left"
        >
          <HelpCircle size={14} />
          <span className="flex-1">{t('level1.hintTitle')}</span>
          {hintOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <AnimatePresence>
          {hintOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-lg px-4 py-2 text-indigo-200 text-xs font-mono leading-normal">
                {t('level1.hint')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Main Puzzle Area ─── */}
        <div className="bg-surface-dark border border-slate-700 rounded-xl p-5 shadow-xl flex flex-col md:flex-row gap-5 items-stretch flex-1">

          {/* Left: Array Visualisation */}
          <div className="flex-1 flex flex-col">
            {/* Stats bar */}
            <div className="flex items-center gap-6 mb-3 text-xs font-mono text-slate-400 tracking-wider">
              <span>{t('level1.pass')}: <span className="text-brand-400 font-bold">{pass}</span></span>
              <span>{t('level1.comparisons')}: <span className="text-brand-400 font-bold">{totalComparisons}</span></span>
              <span>{t('level1.sorted')}: <span className="text-green-400 font-bold">{sortedCount}/{items.length}</span></span>
            </div>

            {/* Bars */}
            <div className="flex flex-col gap-3 flex-1 justify-center">
              {items.map((val, idx) => {
                const isLeft = idx === pointer && !isSolved;
                const isRight = idx === pointer + 1 && !isSolved;
                const isActive = isLeft || isRight;
                const isLocked = idx >= items.length - sortedCount;
                const widthPct = (val / MAX_VALUE) * 100;
                const colorClass = BAR_COLORS[idx % BAR_COLORS.length];

                return (
                  <motion.div
                    key={`bar-${idx}`}
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className={`
                      relative flex items-center gap-3 py-3 px-4 rounded-lg border-2 transition-colors duration-200
                      ${isActive
                        ? 'border-brand-400 bg-brand-500/10 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                        : isLocked
                          ? 'border-green-500/40 bg-green-500/5'
                          : 'border-slate-700 bg-slate-800'
                      }
                      ${mistakeMsg && isActive ? 'border-red-500 bg-red-500/10' : ''}
                    `}
                  >
                    {/* Index label */}
                    <span className="text-xs font-mono text-slate-500 w-5 text-center">{idx}</span>

                    {/* Bar */}
                    <div className="flex-1 h-8 bg-slate-900 rounded overflow-hidden relative">
                      <motion.div
                        className={`h-full rounded bg-gradient-to-r ${isLocked ? 'from-green-600 to-green-500' : colorClass}`}
                        initial={false}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    </div>

                    {/* Value */}
                    <span className={`font-mono font-bold text-sm w-8 text-right ${isLocked ? 'text-green-400' : 'text-slate-300'}`}>
                      {val}
                    </span>

                    {/* Lock icon for sorted elements */}
                    {isLocked && (
                      <Lock size={14} className="text-green-500/60" />
                    )}

                    {/* Pointer indicator */}
                    {isLeft && !isSolved && (
                      <motion.div
                        layoutId="pointerLeft"
                        className="absolute -left-6 top-1/2 -translate-y-1/2 text-brand-400"
                      >
                        <ChevronRight size={18} />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Mistake feedback */}
            <AnimatePresence>
              {mistakeMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="mt-2 p-2 bg-red-950/60 border border-red-500/50 rounded-lg text-red-300 text-xs font-mono text-center"
                >
                  ⚠ {mistakeMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            {!isSolved && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleAction('SWAP')}
                  disabled={!!mistakeMsg}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-mono font-bold tracking-widest rounded transition-all shadow-[0_0_12px_rgba(245,158,11,0.25)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase text-sm"
                >
                  <ArrowLeftRight size={18} />
                  {t('level1.swap')}
                </button>
                <button
                  onClick={() => handleAction('KEEP')}
                  disabled={!!mistakeMsg}
                  className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-mono font-bold tracking-widest rounded transition-all shadow-[0_0_12px_rgba(59,130,246,0.25)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase text-sm"
                >
                  <ChevronRight size={18} />
                  {t('level1.keep')}
                </button>
              </div>
            )}
          </div>

          {/* Right: Door Lock Visualisation */}
          <div className="flex flex-col items-center justify-center w-44 bg-slate-800 rounded-xl border-4 border-slate-900 shadow-inner relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-8 bg-black/40 border-b border-slate-900/50 flex space-around items-center px-4">
              <div className={`w-2 h-2 rounded-full ${isSolved ? 'bg-green-500' : 'bg-red-500/50'} shadow-[0_0_5px_currentColor]`} />
              <div className={`w-2 h-2 rounded-full ${sortedCount > 2 ? 'bg-yellow-500' : 'bg-red-500/50'} shadow-[0_0_5px_currentColor]`} />
              <div className={`w-2 h-2 rounded-full ${isSolved ? 'bg-green-500' : 'bg-green-500/50'} shadow-[0_0_5px_currentColor]`} />
            </div>

            {/* Progress ring */}
            <div className="relative my-3">
              <svg width="80" height="80" viewBox="0 0 80 80" className="rotate-[-90deg]">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgb(51,65,85)" strokeWidth="4" />
                <motion.circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke={isSolved ? '#4ade80' : '#3b82f6'}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 34}
                  animate={{
                    strokeDashoffset: 2 * Math.PI * 34 * (1 - sortedCount / items.length)
                  }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {isSolved
                  ? <Unlock size={32} className="text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
                  : <Lock size={32} className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                }
              </div>
            </div>

            <div className="font-mono text-xs uppercase tracking-widest text-slate-500 text-center px-2 mb-4">
              {isSolved
                ? <span className="text-green-400 font-bold">{t('level1.accessGranted')}</span>
                : t('level1.secureArea')
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
