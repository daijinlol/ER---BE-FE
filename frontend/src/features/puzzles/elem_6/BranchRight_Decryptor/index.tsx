import { useMemo, useState } from 'react';
import { ArrowDownToLine, KeyRound, RotateCcw, ShieldCheck, Usb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../../core/AudioEngine';
import { gameEvents } from '../../../../core/EventBus';
import { useGameSession } from '../../../../core/GameSession';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../../core/gameConstants';
import { usePuzzleValidation } from '../../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../../types';

interface ManifestFile {
    id: string;
    encoded: string;
    decodedLabelKey: string;
    detailKey: string;
}

const SHIFT_OPTIONS = [1, 2, 3] as const;

const FILES: ManifestFile[] = [
    { id: 'manifest_route', encoded: 'SPVUF', decodedLabelKey: 'branchRightDecryptor.decoded.route', detailKey: 'branchRightDecryptor.details.route' },
    { id: 'manifest_crew', encoded: 'ETGY', decodedLabelKey: 'branchRightDecryptor.decoded.crew', detailKey: 'branchRightDecryptor.details.crew' },
    { id: 'manifest_maint', encoded: 'PDLQW', decodedLabelKey: 'branchRightDecryptor.decoded.maint', detailKey: 'branchRightDecryptor.details.maint' },
    { id: 'manifest_quarantine', encoded: 'RVBS', decodedLabelKey: 'branchRightDecryptor.decoded.quarantine', detailKey: 'branchRightDecryptor.details.quarantine' },
];

export default function BranchRightDecryptor({ campaignId, levelId }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { session } = useGameSession();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const [modes, setModes] = useState<Partial<Record<string, number>>>({});
    const [feedbackKey, setFeedbackKey] = useState('branchRightDecryptor.awaiting');
    const [isSolved, setIsSolved] = useState(false);
    const [focusedFileId, setFocusedFileId] = useState<string>('manifest_route');

    const hasDecryptor = session.inventoryItems.includes('usb_decryptor');
    const focusedFile = FILES.find((file) => file.id === focusedFileId) ?? FILES[0];

    const decodedPreview = useMemo(() => {
        const preview: Record<string, string> = {};
        for (const file of FILES) {
            const shift = modes[file.id];
            preview[file.id] = typeof shift === 'number' ? decodeShift(file.encoded, shift) : '-----';
        }
        return preview;
    }, [modes]);

    const handleModeChange = (fileId: string, shift: number) => {
        if (isSolved || isChecking || !hasDecryptor) {
            return;
        }

        audio.playClick();
        setModes((prev) => ({ ...prev, [fileId]: shift }));
        setFocusedFileId(fileId);
        setFeedbackKey('branchRightDecryptor.updated');
    };

    const handleReset = () => {
        if (isSolved || isChecking || !hasDecryptor) {
            return;
        }

        audio.playHover();
        setModes({});
        setFeedbackKey('branchRightDecryptor.awaiting');
    };

    const handleValidate = async () => {
        if (isSolved || isChecking || !hasDecryptor) {
            return;
        }

        audio.playClick();
        const result = await validate({ values: modes });

        if (!result.success) {
            audio.playDeny();
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            setFeedbackKey(Object.keys(modes).length < FILES.length ? 'branchRightDecryptor.incomplete' : 'branchRightDecryptor.failure');
            return;
        }

        audio.playSuccess();
        setIsSolved(true);
        setFeedbackKey('branchRightDecryptor.success');
        window.setTimeout(() => {
            gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'merge_convergence' });
        }, 1800);
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-slate-950 p-3 text-slate-100 xl:overflow-hidden xl:p-4">
            <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-3 xl:gap-4">
                <div className="rounded-2xl border border-amber-400/20 bg-black/45 p-4 shadow-2xl backdrop-blur-md">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 text-amber-300">
                                <Usb size={18} />
                                <div className="text-xs font-mono uppercase tracking-[0.24em]">{t('branchRightDecryptor.kicker')}</div>
                            </div>
                            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{t('branchRightDecryptor.title')}</h2>
                            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">{t('branchRightDecryptor.story')}</p>
                        </div>
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-right">
                            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-300">{t('branchRightDecryptor.decodedCount')}</div>
                            <div className="mt-2 text-2xl text-white">{Object.keys(modes).length}/{FILES.length}</div>
                        </div>
                    </div>
                    <p className="mt-4 border-l-2 border-amber-400 pl-3 text-sm leading-relaxed text-amber-100">{t(feedbackKey)}</p>
                </div>

                <div className="grid flex-1 min-h-0 gap-5 xl:grid-cols-[1.08fr_0.92fr]">
                    <div className="rounded-[1.75rem] border border-slate-700 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),rgba(2,6,23,1)_60%)] p-5 shadow-xl xl:min-h-0 xl:overflow-y-auto xl:pr-3 custom-scrollbar">
                        <div className="rounded-2xl border border-amber-400/20 bg-slate-950/65 px-4 py-3">
                            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-amber-300">{t('branchRightDecryptor.itemTitle')}</div>
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="text-sm text-slate-200">{t('items.usb_decryptor')}</span>
                                <span className={`rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${hasDecryptor ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-red-400/30 bg-red-500/10 text-red-200'}`}>
                                    {hasDecryptor ? t('branchRightDecryptor.itemReady') : t('branchRightDecryptor.itemMissing')}
                                </span>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                            {FILES.map((file) => {
                                const currentMode = modes[file.id];
                                return (
                                    <div
                                        key={file.id}
                                        onMouseEnter={() => setFocusedFileId(file.id)}
                                        className="rounded-2xl border border-slate-700 bg-slate-950/82 p-4"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-300">{file.id}</div>
                                                <div className="mt-2 font-mono text-lg tracking-[0.24em] text-white">{file.encoded}</div>
                                            </div>
                                            <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-center">
                                                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">{t('branchRightDecryptor.previewTitle')}</div>
                                                <div className="mt-1 font-mono text-sm text-amber-100">{decodedPreview[file.id]}</div>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid grid-cols-3 gap-2">
                                            {SHIFT_OPTIONS.map((shift) => {
                                                const selected = currentMode === shift;
                                                return (
                                                    <button
                                                        key={`${file.id}-${shift}`}
                                                        onClick={() => handleModeChange(file.id, shift)}
                                                        disabled={!hasDecryptor || isChecking || isSolved}
                                                        className={`rounded-xl border px-3 py-3 text-sm transition-colors ${selected
                                                            ? 'border-amber-300/70 bg-amber-500/16 text-amber-100'
                                                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-amber-400/40'} disabled:cursor-not-allowed disabled:opacity-50`}
                                                    >
                                                        <div className="text-[10px] font-mono uppercase tracking-[0.18em]">{t('branchRightDecryptor.shiftLabel', { value: shift })}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                        <div className="rounded-2xl border border-slate-700 bg-black/35 p-4 shadow-xl">
                            <div className="flex items-center gap-2 text-amber-300">
                                <ShieldCheck size={16} />
                                <span className="text-xs font-mono uppercase tracking-[0.2em]">{t('branchRightDecryptor.objectiveTitle')}</span>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-slate-300">{t('branchRightDecryptor.objective')}</p>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-black/35 p-4 shadow-xl">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('branchRightDecryptor.rulesTitle')}</div>
                            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
                                <li>{t('branchRightDecryptor.rules.1')}</li>
                                <li>{t('branchRightDecryptor.rules.2')}</li>
                                <li>{t('branchRightDecryptor.rules.3')}</li>
                            </ul>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-black/35 p-4 shadow-xl">
                            <div className="flex items-center gap-2 text-amber-300">
                                <KeyRound size={16} />
                                <span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('branchRightDecryptor.focusTitle')}</span>
                            </div>
                            <div className="mt-3 rounded-2xl border border-amber-400/20 bg-slate-950/80 p-4">
                                <div className="text-sm font-medium text-white">{focusedFile.id}</div>
                                <div className="mt-2 font-mono text-lg tracking-[0.24em] text-amber-100">{focusedFile.encoded}</div>
                                <div className="mt-4 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">{t('branchRightDecryptor.decodedLabel')}</div>
                                <div className="mt-1 text-sm text-slate-200">{t(focusedFile.decodedLabelKey)}</div>
                                <p className="mt-4 text-sm leading-relaxed text-slate-300">{t(focusedFile.detailKey)}</p>
                            </div>
                        </div>

                        <div className="grid gap-3 pt-1 sm:grid-cols-2 xl:grid-cols-1">
                            <button
                                onClick={handleReset}
                                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs uppercase tracking-[0.22em] text-slate-200 transition-colors hover:border-slate-500"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <RotateCcw size={15} />
                                    <span>{t('branchRightDecryptor.reset')}</span>
                                </div>
                            </button>
                            <button
                                onClick={handleValidate}
                                disabled={isChecking || isSolved || !hasDecryptor}
                                className="rounded-2xl border border-amber-400/45 bg-amber-500/10 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <ArrowDownToLine size={15} />
                                    <span>{isChecking ? t('branchRightDecryptor.validating') : t('branchRightDecryptor.validate')}</span>
                                </div>
                            </button>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                            {error ?? t(isSolved ? 'branchRightDecryptor.success' : hasDecryptor ? 'branchRightDecryptor.statusHint' : 'branchRightDecryptor.itemBlocked')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function decodeShift(value: string, shift: number) {
    return value
        .split('')
        .map((character) => {
            const code = character.charCodeAt(0);
            if (code < 65 || code > 90) {
                return character;
            }
            const normalized = code - 65;
            const decoded = (normalized - shift + 26) % 26;
            return String.fromCharCode(decoded + 65);
        })
        .join('');
}