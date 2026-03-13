import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../../core/AudioEngine';
import { gameEvents } from '../../../../core/EventBus';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../../core/gameConstants';
import { usePuzzleValidation } from '../../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../../types';
import { ArchiveButton, ArchivePuzzleFrame, ArchiveStatCard } from '../shared';

const OVERLAY_KEYS = ['north_register', 'river_parcels', 'market_rolls', 'council_minutes'] as const;

export default function Level5MapOverlay({ campaignId, levelId }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const [values, setValues] = useState<Record<string, number>>({
        north_register: 1,
        river_parcels: 1,
        market_rolls: 1,
        council_minutes: 1,
    });
    const [feedbackKey, setFeedbackKey] = useState('elem7.level5.feedback.start');
    const [isSolved, setIsSolved] = useState(false);

    const cycleValue = (key: string) => {
        if (isSolved) {
            return;
        }

        audio.playClick();
        setValues((prev) => ({
            ...prev,
            [key]: prev[key] >= 3 ? 1 : prev[key] + 1,
        }));
        setFeedbackKey('elem7.level5.feedback.updated');
    };

    const handleValidate = async () => {
        if (isSolved || isChecking) {
            return;
        }

        audio.playClick();
        const result = await validate({ values });
        if (!result.success) {
            audio.playDeny();
            setFeedbackKey('elem7.level5.feedback.failure');
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            return;
        }

        setIsSolved(true);
        setFeedbackKey('elem7.level5.feedback.success');
        audio.playSuccess();
        result.unlocks.forEach((item) => gameEvents.publish('ITEM_FOUND', item));
        window.setTimeout(() => gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' }), 1200);
    };

    return (
        <ArchivePuzzleFrame
            subtitle={t('elem7.level5.subtitle')}
            title={t('elem7.level5.title')}
            story={t('elem7.level5.story')}
            feedback={error ?? t(feedbackKey)}
        >
            <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <section className="grid gap-4 rounded-[1.75rem] border border-amber-700/30 bg-[#1d140d]/88 p-5 shadow-xl md:grid-cols-2">
                    {OVERLAY_KEYS.map((key) => (
                        <button key={key} onClick={() => cycleValue(key)} className="rounded-[1.5rem] border border-stone-700 bg-black/20 p-4 text-left transition-colors hover:border-amber-500/30 hover:bg-amber-500/8">
                            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-stone-400">{t('elem7.level5.bundleLabel')}</div>
                            <h3 className="mt-2 text-lg font-semibold text-stone-100">{t(`elem7.level5.bundles.${key}.title`)}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-stone-300">{t(`elem7.level5.bundles.${key}.body`)}</p>
                            <div className="mt-4 inline-flex rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 font-mono text-sm text-amber-100">
                                {t('elem7.level5.mapLayer', { value: values[key] })}
                            </div>
                        </button>
                    ))}
                </section>

                <aside className="flex flex-col gap-4 rounded-[1.75rem] border border-stone-700 bg-black/20 p-5">
                    <ArchiveStatCard label={t('elem7.level5.overlayCount')} value={String(OVERLAY_KEYS.length)} />
                    <ArchiveStatCard label={t('elem7.level5.mapState')} value={isSolved ? t('elem7.common.restored') : t('elem7.common.pending')} accent={isSolved ? 'emerald' : 'stone'} />
                    <div className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4 text-sm leading-relaxed text-stone-300">
                        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200">{t('elem7.level5.hintTitle')}</div>
                        <p className="mt-2">{t('elem7.level5.hint')}</p>
                    </div>
                    <ArchiveButton label={t('elem7.level5.validate')} onClick={handleValidate} disabled={isSolved || isChecking} />
                </aside>
            </div>
        </ArchivePuzzleFrame>
    );
}