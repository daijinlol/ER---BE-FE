import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../../core/AudioEngine';
import { gameEvents } from '../../../../core/EventBus';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../../core/gameConstants';
import { usePuzzleValidation } from '../../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../../types';
import { ArchiveButton, ArchivePuzzleFrame, ArchiveStatCard } from '../shared';

const INITIAL_SEQUENCE = [
    'annotate_margin',
    'receive_request',
    'store_duplicate',
    'verify_seal',
    'check_index',
];

export default function Level3FilingProcedure({ campaignId, levelId }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const [sequence, setSequence] = useState(INITIAL_SEQUENCE);
    const [feedbackKey, setFeedbackKey] = useState('elem7.level3.feedback.start');
    const [isSolved, setIsSolved] = useState(false);

    const moveStep = (index: number, direction: -1 | 1) => {
        if (isSolved) {
            return;
        }

        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= sequence.length) {
            return;
        }

        audio.playClick();
        const nextSequence = [...sequence];
        [nextSequence[index], nextSequence[nextIndex]] = [nextSequence[nextIndex], nextSequence[index]];
        setSequence(nextSequence);
        setFeedbackKey('elem7.level3.feedback.updated');
    };

    const handleValidate = async () => {
        if (isSolved || isChecking) {
            return;
        }

        audio.playClick();
        const result = await validate({ sequence });
        if (!result.success) {
            audio.playDeny();
            setFeedbackKey('elem7.level3.feedback.failure');
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            return;
        }

        setIsSolved(true);
        setFeedbackKey('elem7.level3.feedback.success');
        audio.playSuccess();
        result.unlocks.forEach((item) => gameEvents.publish('ITEM_FOUND', item));
        window.setTimeout(() => gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' }), 1200);
    };

    return (
        <ArchivePuzzleFrame
            subtitle={t('elem7.level3.subtitle')}
            title={t('elem7.level3.title')}
            story={t('elem7.level3.story')}
            feedback={error ?? t(feedbackKey)}
        >
            <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <section className="rounded-[1.75rem] border border-amber-700/30 bg-[#1d140d]/88 p-5 shadow-xl">
                    <div className="space-y-3">
                        {sequence.map((step, index) => (
                            <div key={step} className="flex items-center justify-between gap-4 rounded-2xl border border-stone-700 bg-black/20 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl border border-amber-600/30 bg-amber-500/10 px-3 py-2 text-sm font-mono text-amber-100">{index + 1}</div>
                                    <div>
                                        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-stone-400">{t('elem7.level3.stepLabel')}</div>
                                        <div className="mt-1 text-sm text-stone-100">{t(`elem7.level3.steps.${step}`)}</div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => moveStep(index, -1)} disabled={index === 0 || isSolved} className="rounded border border-stone-700 p-2 text-stone-300 transition-colors hover:border-amber-500/40 hover:text-amber-100 disabled:opacity-40"><ArrowUp size={16} /></button>
                                    <button onClick={() => moveStep(index, 1)} disabled={index === sequence.length - 1 || isSolved} className="rounded border border-stone-700 p-2 text-stone-300 transition-colors hover:border-amber-500/40 hover:text-amber-100 disabled:opacity-40"><ArrowDown size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <aside className="flex flex-col gap-4 rounded-[1.75rem] border border-stone-700 bg-black/20 p-5">
                    <ArchiveStatCard label={t('elem7.level3.totalSteps')} value={String(sequence.length)} />
                    <ArchiveStatCard label={t('elem7.level3.sequenceState')} value={isSolved ? t('elem7.common.restored') : t('elem7.common.pending')} accent={isSolved ? 'emerald' : 'stone'} />
                    <div className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4 text-sm leading-relaxed text-stone-300">
                        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200">{t('elem7.level3.hintTitle')}</div>
                        <p className="mt-2">{t('elem7.level3.hint')}</p>
                    </div>
                    <ArchiveButton label={t('elem7.level3.validate')} onClick={handleValidate} disabled={isSolved || isChecking} />
                </aside>
            </div>
        </ArchivePuzzleFrame>
    );
}