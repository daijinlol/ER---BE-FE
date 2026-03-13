import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../../core/AudioEngine';
import { gameEvents } from '../../../../core/EventBus';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../../core/gameConstants';
import { usePuzzleValidation } from '../../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../../types';
import { ArchiveButton, ArchivePuzzleFrame, ArchiveStatCard } from '../shared';

const JUNCTIONS = ['junction_alpha', 'junction_beta', 'junction_gamma'] as const;
const RULE_OPTIONS = ['stable', 'archive_tag', 'high_priority', 'cyan_tag'] as const;

export default function Level4IndexRouter({ campaignId, levelId }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const [rules, setRules] = useState<Record<string, string>>({});
    const [feedbackKey, setFeedbackKey] = useState('elem7.level4.feedback.start');
    const [isSolved, setIsSolved] = useState(false);

    const handleValidate = async () => {
        if (isSolved || isChecking) {
            return;
        }

        audio.playClick();
        const result = await validate({ rules });
        if (!result.success) {
            audio.playDeny();
            setFeedbackKey('elem7.level4.feedback.failure');
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            return;
        }

        setIsSolved(true);
        setFeedbackKey('elem7.level4.feedback.success');
        audio.playSuccess();
        result.unlocks.forEach((item) => gameEvents.publish('ITEM_FOUND', item));
        window.setTimeout(() => gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' }), 1200);
    };

    return (
        <ArchivePuzzleFrame
            subtitle={t('elem7.level4.subtitle')}
            title={t('elem7.level4.title')}
            story={t('elem7.level4.story')}
            feedback={error ?? t(feedbackKey)}
        >
            <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <section className="rounded-[1.75rem] border border-amber-700/30 bg-[#1d140d]/88 p-5 shadow-xl">
                    <div className="grid gap-4 lg:grid-cols-3">
                        {JUNCTIONS.map((junction) => (
                            <div key={junction} className="rounded-[1.5rem] border border-stone-700 bg-black/20 p-4">
                                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-stone-400">{t(`elem7.level4.junctions.${junction}.label`)}</div>
                                <h3 className="mt-2 text-lg font-semibold text-stone-100">{t(`elem7.level4.junctions.${junction}.title`)}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-stone-300">{t(`elem7.level4.junctions.${junction}.body`)}</p>
                                <div className="mt-4 space-y-2">
                                    {RULE_OPTIONS.map((option) => {
                                        const active = rules[junction] === option;
                                        return (
                                            <button
                                                key={option}
                                                onClick={() => {
                                                    audio.playClick();
                                                    setRules((prev) => ({ ...prev, [junction]: option }));
                                                    setFeedbackKey('elem7.level4.feedback.updated');
                                                }}
                                                className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition-colors ${active ? 'border-amber-400/50 bg-amber-500/12 text-amber-50' : 'border-stone-700 bg-stone-950/50 text-stone-200 hover:border-amber-500/30'}`}
                                            >
                                                {t(`elem7.level4.rules.${option}`)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <aside className="flex flex-col gap-4 rounded-[1.75rem] border border-stone-700 bg-black/20 p-5">
                    <ArchiveStatCard label={t('elem7.level4.assignedRules')} value={String(Object.keys(rules).length)} />
                    <ArchiveStatCard label={t('elem7.level4.routerState')} value={isSolved ? t('elem7.common.restored') : t('elem7.common.pending')} accent={isSolved ? 'emerald' : 'stone'} />
                    <div className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4 text-sm leading-relaxed text-stone-300">
                        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200">{t('elem7.level4.hintTitle')}</div>
                        <p className="mt-2">{t('elem7.level4.hint')}</p>
                    </div>
                    <ArchiveButton label={t('elem7.level4.validate')} onClick={handleValidate} disabled={isSolved || isChecking} />
                </aside>
            </div>
        </ArchivePuzzleFrame>
    );
}