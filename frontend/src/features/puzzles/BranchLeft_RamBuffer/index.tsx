import { useState } from 'react';
import { Cpu, RotateCcw, SendHorizontal, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';
import { useGameSession } from '../../../core/GameSession';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../core/gameConstants';
import { usePuzzleValidation } from '../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../types';

interface Fragment {
    id: string;
    labelKey: string;
    clueKey: string;
    tone: 'cyan' | 'amber' | 'emerald';
}

const FRAGMENTS: Fragment[] = [
    { id: 'boot', labelKey: 'branchLeftBuffer.fragments.boot', clueKey: 'branchLeftBuffer.fragmentClues.boot', tone: 'cyan' },
    { id: 'route', labelKey: 'branchLeftBuffer.fragments.route', clueKey: 'branchLeftBuffer.fragmentClues.route', tone: 'amber' },
    { id: 'parity', labelKey: 'branchLeftBuffer.fragments.parity', clueKey: 'branchLeftBuffer.fragmentClues.parity', tone: 'emerald' },
    { id: 'auth', labelKey: 'branchLeftBuffer.fragments.auth', clueKey: 'branchLeftBuffer.fragmentClues.auth', tone: 'cyan' },
    { id: 'checksum', labelKey: 'branchLeftBuffer.fragments.checksum', clueKey: 'branchLeftBuffer.fragmentClues.checksum', tone: 'amber' },
    { id: 'echo', labelKey: 'branchLeftBuffer.fragments.echo', clueKey: 'branchLeftBuffer.fragmentClues.echo', tone: 'emerald' },
];

const BUFFER_CAPACITY = 5;

export default function BranchLeftRamBuffer({ campaignId, levelId }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { session } = useGameSession();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const [sequence, setSequence] = useState<string[]>([]);
    const [feedbackKey, setFeedbackKey] = useState('branchLeftBuffer.awaiting');
    const [isSolved, setIsSolved] = useState(false);
    const [focusedFragmentId, setFocusedFragmentId] = useState<string>('boot');

    const hasModule = session.inventoryItems.includes('module_ram');
    const focusedFragment = FRAGMENTS.find((fragment) => fragment.id === focusedFragmentId) ?? FRAGMENTS[0];
    const handleAddFragment = (fragmentId: string) => {
        if (isSolved || isChecking || !hasModule || sequence.length >= BUFFER_CAPACITY || sequence.includes(fragmentId)) {
            return;
        }

        audio.playClick();
        setSequence((prev) => [...prev, fragmentId]);
        setFocusedFragmentId(fragmentId);
        setFeedbackKey(sequence.length + 1 === BUFFER_CAPACITY ? 'branchLeftBuffer.ready' : 'branchLeftBuffer.updated');
    };

    const handleRemoveFragment = (index: number) => {
        if (isSolved || isChecking || !hasModule) {
            return;
        }

        audio.playHover();
        setSequence((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
        setFeedbackKey('branchLeftBuffer.removed');
    };

    const handleReset = () => {
        if (isSolved || isChecking || !hasModule) {
            return;
        }

        audio.playHover();
        setSequence([]);
        setFeedbackKey('branchLeftBuffer.awaiting');
    };

    const handleTransmit = async () => {
        if (isSolved || isChecking || !hasModule) {
            return;
        }

        audio.playClick();
        const result = await validate({ sequence });

        if (!result.success) {
            audio.playDeny();
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            setFeedbackKey(sequence.length < BUFFER_CAPACITY ? 'branchLeftBuffer.incomplete' : 'branchLeftBuffer.failure');
            return;
        }

        audio.playSuccess();
        setIsSolved(true);
        setFeedbackKey('branchLeftBuffer.success');
        window.setTimeout(() => {
            gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'merge_convergence' });
        }, 1800);
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-slate-950 p-4 text-slate-100">
            <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4">
                <div className="rounded-2xl border border-cyan-400/20 bg-black/45 p-4 shadow-2xl backdrop-blur-md">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 text-cyan-300">
                                <Cpu size={18} />
                                <div className="text-xs font-mono uppercase tracking-[0.24em]">{t('branchLeftBuffer.kicker')}</div>
                            </div>
                            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{t('branchLeftBuffer.title')}</h2>
                            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">{t('branchLeftBuffer.story')}</p>
                        </div>
                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-right">
                            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-300">{t('branchLeftBuffer.bufferSlots')}</div>
                            <div className="mt-2 text-2xl text-white">{sequence.length}/{BUFFER_CAPACITY}</div>
                        </div>
                    </div>
                    <p className="mt-4 border-l-2 border-cyan-400 pl-3 text-sm leading-relaxed text-cyan-100">{t(feedbackKey)}</p>
                </div>

                <div className="grid flex-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[1.75rem] border border-slate-700 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),rgba(2,6,23,1)_62%)] p-5 shadow-xl">
                        <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/65 px-4 py-3">
                            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-cyan-300">{t('branchLeftBuffer.itemTitle')}</div>
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="text-sm text-slate-200">{t('items.module_ram')}</span>
                                <span className={`rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${hasModule ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-red-400/30 bg-red-500/10 text-red-200'}`}>
                                    {hasModule ? t('branchLeftBuffer.itemReady') : t('branchLeftBuffer.itemMissing')}
                                </span>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {FRAGMENTS.map((fragment) => {
                                const selected = sequence.includes(fragment.id);
                                return (
                                    <button
                                        key={fragment.id}
                                        onClick={() => handleAddFragment(fragment.id)}
                                        onMouseEnter={() => setFocusedFragmentId(fragment.id)}
                                        disabled={selected || !hasModule || isChecking || isSolved || sequence.length >= BUFFER_CAPACITY}
                                        className={`rounded-2xl border p-4 text-left transition-colors ${selected
                                            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                                            : 'border-slate-700 bg-slate-900/85 text-slate-200 hover:border-cyan-400/35 hover:bg-cyan-500/10'} disabled:cursor-not-allowed disabled:opacity-60`}
                                    >
                                        <div className={`text-[10px] font-mono uppercase tracking-[0.2em] ${fragment.tone === 'cyan' ? 'text-cyan-300' : fragment.tone === 'amber' ? 'text-amber-300' : 'text-emerald-300'}`}>
                                            {fragment.id}
                                        </div>
                                        <div className="mt-2 text-sm font-medium text-white">{t(fragment.labelKey)}</div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-950/75 p-4">
                            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">{t('branchLeftBuffer.bufferTitle')}</div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-5">
                                {Array.from({ length: BUFFER_CAPACITY }).map((_, index) => {
                                    const fragmentId = sequence[index];
                                    const fragment = FRAGMENTS.find((entry) => entry.id === fragmentId);
                                    return (
                                        <button
                                            key={`slot-${index}`}
                                            onClick={() => fragmentId && handleRemoveFragment(index)}
                                            className={`min-h-[7rem] rounded-2xl border px-3 py-4 text-left transition-colors ${fragment
                                                ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:border-red-400/30 hover:bg-red-500/10'
                                                : 'border-slate-800 bg-slate-900/80 text-slate-500'}`}
                                        >
                                            <div className="text-[10px] font-mono uppercase tracking-[0.2em]">{t('branchLeftBuffer.slotLabel', { value: index + 1 })}</div>
                                            <div className="mt-3 text-sm font-medium text-white">{fragment ? t(fragment.labelKey) : t('branchLeftBuffer.emptySlot')}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="rounded-2xl border border-slate-700 bg-black/35 p-4 shadow-xl">
                            <div className="flex items-center gap-2 text-cyan-300">
                                <ShieldCheck size={16} />
                                <span className="text-xs font-mono uppercase tracking-[0.2em]">{t('branchLeftBuffer.objectiveTitle')}</span>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-slate-300">{t('branchLeftBuffer.objective')}</p>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-black/35 p-4 shadow-xl">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('branchLeftBuffer.rulesTitle')}</div>
                            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
                                <li>{t('branchLeftBuffer.rules.1')}</li>
                                <li>{t('branchLeftBuffer.rules.2')}</li>
                                <li>{t('branchLeftBuffer.rules.3')}</li>
                                <li>{t('branchLeftBuffer.rules.4')}</li>
                                <li>{t('branchLeftBuffer.rules.5')}</li>
                            </ul>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-black/35 p-4 shadow-xl">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('branchLeftBuffer.fragmentFocusTitle')}</div>
                            <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-4">
                                <div className="text-sm font-medium text-white">{t(focusedFragment.labelKey)}</div>
                                <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">{focusedFragment.id}</div>
                                <p className="mt-4 text-sm leading-relaxed text-slate-300">{t(focusedFragment.clueKey)}</p>
                            </div>
                        </div>

                        <div className="mt-auto grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                            <button
                                onClick={handleReset}
                                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs uppercase tracking-[0.22em] text-slate-200 transition-colors hover:border-slate-500"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <RotateCcw size={15} />
                                    <span>{t('branchLeftBuffer.reset')}</span>
                                </div>
                            </button>
                            <button
                                onClick={handleTransmit}
                                disabled={isChecking || isSolved || !hasModule}
                                className="rounded-2xl border border-cyan-400/45 bg-cyan-500/10 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-cyan-100 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <SendHorizontal size={15} />
                                    <span>{isChecking ? t('branchLeftBuffer.validating') : t('branchLeftBuffer.validate')}</span>
                                </div>
                            </button>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                            {error ?? t(isSolved ? 'branchLeftBuffer.success' : hasModule ? 'branchLeftBuffer.statusHint' : 'branchLeftBuffer.itemBlocked')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}