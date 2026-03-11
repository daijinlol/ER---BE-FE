import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { gameEvents } from '../../../core/EventBus';
import { usePuzzleValidation } from '../../../hooks/usePuzzleValidation';
import { audio } from '../../../core/AudioEngine';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../core/gameConstants';
import type { PuzzleComponentProps } from '../types';
import {
  Lock,
  Unlock,
  ArrowLeftRight,
  ChevronRight,
  Terminal,
  X,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Gauge,
} from 'lucide-react';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let temp = Math.imul(seed ^ seed >>> 15, 1 | seed);
    temp = temp + Math.imul(temp ^ temp >>> 7, 61 | temp) ^ temp;
    return ((temp ^ temp >>> 14) >>> 0) / 4294967296;
  };
}

function shuffleArray(arr: number[], seed: number): number[] {
  const shuffled = [...arr];
  const rng = mulberry32(seed);

  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

const SORTED_VALUES = [5, 17, 29, 42, 61, 83];
const SEED = 2026;
const MAX_VALUE = 83;

const BAR_COLORS = [
  'from-cyan-500 to-sky-400',
  'from-sky-500 to-blue-400',
  'from-indigo-500 to-cyan-400',
  'from-violet-500 to-fuchsia-400',
  'from-amber-500 to-orange-400',
  'from-emerald-500 to-cyan-400',
];

export default function Level1Sorting({ campaignId, levelId }: PuzzleComponentProps) {
  const { t } = useTranslation();
  const { validate } = usePuzzleValidation(campaignId, levelId);

  const initialArray = useMemo(() => {
    let shuffled = shuffleArray(SORTED_VALUES, SEED);
    while (JSON.stringify(shuffled) === JSON.stringify(SORTED_VALUES)) {
      shuffled = shuffleArray(SORTED_VALUES, SEED + 1);
    }
    return shuffled;
  }, []);

  const [items, setItems] = useState<number[]>(initialArray);
  const [pointer, setPointer] = useState(0);
  const [pass, setPass] = useState(1);
  const [totalComparisons, setTotalComparisons] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [sortedCount, setSortedCount] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [swappedInPass, setSwappedInPass] = useState(false);
  const [terminalKey, setTerminalKey] = useState('level1.awaitingSort');
  const [mistakeMsg, setMistakeMsg] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);

  const passLimit = items.length - 1 - sortedCount;
  const leftValue = items[pointer];
  const rightValue = items[pointer + 1];
  const comparisonSummary = isSolved || rightValue === undefined
    ? t('level1.noActivePair')
    : leftValue > rightValue
      ? t('level1.pairRelationGreater', { left: leftValue, right: rightValue })
      : t('level1.pairRelationOrdered', { left: leftValue, right: rightValue });

  const handleSolved = async () => {
    setIsSolved(true);
    setTerminalKey('level1.sortComplete');
    audio.playSuccess();

    const check = await validate({
      sorted_array: [...items].sort((a, b) => a - b),
      total_comparisons: totalComparisons + 1,
      mistakes,
    });

    if (check.success) {
      window.setTimeout(() => {
        setTerminalKey('level1.cartridgeReady');
      }, 1200);

      window.setTimeout(() => {
        gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
      }, 2600);
    }
  };

  const handleAction = useCallback((action: 'SWAP' | 'KEEP') => {
    if (isSolved || mistakeMsg) {
      return;
    }

    const left = items[pointer];
    const right = items[pointer + 1];
    const shouldSwap = left > right;

    if ((action === 'SWAP' && !shouldSwap) || (action === 'KEEP' && shouldSwap)) {
      audio.playDeny();
      setMistakes((prev) => prev + 1);
      gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });

      const key = action === 'SWAP' ? 'level1.mistakeSwap' : 'level1.mistakeKeep';
      setMistakeMsg(t(key, { a: left, b: right }));
      window.setTimeout(() => setMistakeMsg(null), 2200);
      return;
    }

    audio.playClick();
    setTotalComparisons((prev) => prev + 1);

    if (action === 'SWAP') {
      const nextItems = [...items];
      [nextItems[pointer], nextItems[pointer + 1]] = [nextItems[pointer + 1], nextItems[pointer]];
      setItems(nextItems);
      setSwappedInPass(true);
    }

    const nextPointer = pointer + 1;

    if (nextPointer >= passLimit) {
      const nextSortedCount = sortedCount + 1;
      setSortedCount(nextSortedCount);

      if (nextSortedCount >= items.length - 1 || (!swappedInPass && action !== 'SWAP')) {
        setSortedCount(items.length);
        handleSolved();
        return;
      }

      setPass((prev) => prev + 1);
      setPointer(0);
      setSwappedInPass(false);
      return;
    }

    setPointer(nextPointer);
  }, [isSolved, items, mistakeMsg, passLimit, pointer, sortedCount, swappedInPass, t, totalComparisons, mistakes]);

  return (
    <div className="relative h-full w-full overflow-y-auto bg-slate-950 p-3 text-slate-100 xl:overflow-hidden xl:p-3">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),rgba(2,6,23,1)_56%)]" />
      <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-3">
        <div className="rounded-2xl border border-cyan-400/20 bg-black/40 p-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 text-cyan-300">
                <Terminal size={18} />
                <div className="text-xs font-mono uppercase tracking-[0.24em]">{t('level1.subtitle')}</div>
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white xl:text-[1.65rem]">{t('level1.title')}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300 xl:text-[13px]">{t('level1.story')}</p>
            </div>
            <button
              onClick={() => {
                audio.playClick();
                gameEvents.publish('PUZZLE_CLOSED');
              }}
              className="rounded-xl border border-slate-700 bg-slate-900/80 p-2 text-slate-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
              title="Close Interface"
            >
              <X size={20} />
            </button>
          </div>
          <p className="mt-3 border-l-2 border-cyan-400 pl-3 text-sm leading-relaxed text-cyan-100 xl:text-[13px]">{t(terminalKey)}</p>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-[1.75rem] border border-slate-700 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),rgba(2,6,23,1)_62%)] p-4 shadow-xl">
            <div className="grid gap-2 sm:grid-cols-3">
              <StatCard label={t('level1.pass')} value={String(pass)} accent="cyan" />
              <StatCard label={t('level1.comparisons')} value={String(totalComparisons)} accent="sky" />
              <StatCard label={t('level1.sorted')} value={`${sortedCount}/${items.length}`} accent="emerald" />
            </div>

            <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-cyan-300">{t('level1.activePairTitle')}</div>
                  <div className="mt-1.5 text-sm text-slate-300 xl:text-[13px]">{comparisonSummary}</div>
                </div>
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2.5 text-right">
                  <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-cyan-200">{t('level1.passStatusTitle')}</div>
                  <div className="mt-2 font-mono text-lg text-white">{Math.max(passLimit, 0)}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {items.map((value, index) => {
                  const isLeft = index === pointer && !isSolved;
                  const isActive = (index === pointer || index === pointer + 1) && !isSolved;
                  const isLocked = index >= items.length - sortedCount;
                  const widthPct = (value / MAX_VALUE) * 100;
                  const colorClass = BAR_COLORS[index % BAR_COLORS.length];

                  return (
                    <motion.div
                      key={`bar-${index}`}
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      className={`relative overflow-hidden rounded-2xl border px-3 py-2.5 transition-all ${isActive
                        ? 'border-cyan-300/60 bg-cyan-500/10 shadow-[0_0_22px_rgba(34,211,238,0.14)]'
                        : isLocked
                          ? 'border-emerald-400/30 bg-emerald-500/8'
                          : 'border-slate-800 bg-slate-900/80'} ${mistakeMsg && isActive ? 'border-red-500/60 bg-red-500/10' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 text-center text-xs font-mono uppercase tracking-[0.22em] text-slate-500">{index}</div>
                        <div className="relative h-8 flex-1 overflow-hidden rounded-full border border-slate-800 bg-slate-950">
                          <motion.div
                            className={`h-full rounded-full bg-gradient-to-r ${isLocked ? 'from-emerald-600 to-emerald-400' : colorClass}`}
                            initial={false}
                            animate={{ width: `${widthPct}%` }}
                            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                          />
                          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)] opacity-50" />
                        </div>
                        <div className={`w-10 text-right font-mono text-sm font-bold ${isLocked ? 'text-emerald-300' : 'text-slate-100'}`}>{value}</div>
                        {isLocked && <Lock size={14} className="text-emerald-300/70" />}
                      </div>

                      {isLeft && !isSolved && (
                        <motion.div layoutId="sorting-pointer" className="absolute -left-2 top-1/2 -translate-y-1/2 text-cyan-300">
                          <ChevronRight size={18} />
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <AnimatePresence>
              {mistakeMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mt-3 rounded-2xl border border-red-500/40 bg-red-950/45 px-4 py-3 text-sm text-red-200 xl:text-[13px]"
                >
                  {mistakeMsg}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-3 xl:min-h-0 xl:overflow-y-auto xl:pr-1 custom-scrollbar">
            <div className="rounded-2xl border border-slate-700 bg-black/35 p-3 shadow-xl">
              <div className="flex items-center gap-2 text-cyan-300">
                <ShieldCheck size={16} />
                <span className="text-xs font-mono uppercase tracking-[0.2em]">{t('level1.objectiveTitle')}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-300 xl:text-[13px]">{t('level1.objective')}</p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-black/35 p-3 shadow-xl">
              <button
                onClick={() => setHintOpen((prev) => !prev)}
                className="flex w-full items-center gap-2 text-left text-indigo-200 transition-colors hover:text-indigo-100"
              >
                <HelpCircle size={16} />
                <span className="flex-1 text-xs font-mono uppercase tracking-[0.2em]">{t('level1.hintTitle')}</span>
                {hintOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <AnimatePresence>
                {hintOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 rounded-2xl border border-indigo-400/20 bg-indigo-950/30 px-4 py-3 text-sm leading-relaxed text-indigo-100 xl:text-[13px]">
                      {t('level1.hint')}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-black/35 p-3 shadow-xl">
              <div className="flex items-center gap-2 text-slate-300">
                <Gauge size={16} />
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('level1.diagnosticsTitle')}</span>
              </div>
              <div className="mt-3 space-y-2">
                <MetricRow label={t('level1.pass')} value={String(pass)} accent="text-cyan-300" />
                <MetricRow label={t('level1.comparisons')} value={String(totalComparisons)} accent="text-sky-300" />
                <MetricRow label={t('level1.sorted')} value={`${sortedCount}/${items.length}`} accent="text-emerald-300" />
                <MetricRow label={t('level2.mistakes')} value={String(mistakes)} accent="text-red-300" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-black/35 p-3 shadow-xl">
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('level1.actionsTitle')}</div>
              {!isSolved ? (
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
                  <button
                    onClick={() => handleAction('SWAP')}
                    disabled={!!mistakeMsg}
                    className="rounded-2xl border border-amber-400/45 bg-amber-500/12 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <ArrowLeftRight size={15} />
                      <span>{t('level1.swap')}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleAction('KEEP')}
                    disabled={!!mistakeMsg}
                    className="rounded-2xl border border-cyan-400/45 bg-cyan-500/10 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-cyan-100 transition-colors hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <ChevronRight size={15} />
                      <span>{t('level1.keep')}</span>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-center">
                  <div className="flex items-center justify-center gap-2 text-emerald-200">
                    <Unlock size={16} />
                    <span className="text-xs font-mono uppercase tracking-[0.22em]">{t('level1.accessGranted')}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-slate-700 bg-slate-950/80 px-4 py-4 text-center shadow-xl">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80">
                <div className="relative">
                  <svg width="84" height="84" viewBox="0 0 96 96" className="-rotate-90">
                    <circle cx="48" cy="48" r="38" fill="none" stroke="rgb(51,65,85)" strokeWidth="6" />
                    <motion.circle
                      cx="48"
                      cy="48"
                      r="38"
                      fill="none"
                      stroke={isSolved ? '#4ade80' : '#22d3ee'}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 38}
                      animate={{ strokeDashoffset: 2 * Math.PI * 38 * (1 - sortedCount / items.length) }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isSolved
                      ? <Unlock size={26} className="text-emerald-300" />
                      : <Lock size={26} className="text-cyan-300" />}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs font-mono uppercase tracking-[0.22em] text-slate-500">{t('level1.passStatusTitle')}</div>
              <div className={`mt-1.5 text-sm font-medium xl:text-[13px] ${isSolved ? 'text-emerald-300' : 'text-slate-300'}`}>
                {isSolved ? t('level1.accessGranted') : t('level1.secureArea')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: 'cyan' | 'sky' | 'emerald' }) {
  const accentClasses = {
    cyan: 'text-cyan-300 border-cyan-400/20 bg-cyan-500/8',
    sky: 'text-sky-300 border-sky-400/20 bg-sky-500/8',
    emerald: 'text-emerald-300 border-emerald-400/20 bg-emerald-500/8',
  };

  return (
    <div className={`rounded-2xl border px-4 py-2.5 ${accentClasses[accent]}`}>
      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1.5 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function MetricRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
      <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${accent}`}>{value}</span>
    </div>
  );
}
