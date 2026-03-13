import { motion } from 'framer-motion';
import { ArrowRight, GitMerge } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../../core/AudioEngine';
import { gameEvents } from '../../../../core/EventBus';

export default function BranchConvergence() {
    const { t } = useTranslation();

    return (
        <div className="relative h-full w-full overflow-hidden bg-slate-950 text-slate-100">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),rgba(2,6,23,1)_62%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(34,211,238,0.08)_28%,transparent_28%,transparent_45%,rgba(245,158,11,0.08)_45%,transparent_70%)] opacity-80" />

            <div className="relative mx-auto flex h-full max-w-5xl items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full rounded-[2rem] border border-slate-700 bg-slate-950/82 p-8 shadow-[0_25px_90px_rgba(2,6,23,0.45)] backdrop-blur-md"
                >
                    <div className="flex items-center gap-3 text-cyan-300">
                        <GitMerge size={18} />
                        <div className="text-xs font-mono uppercase tracking-[0.26em]">{t('branchConvergence.kicker')}</div>
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">{t('branchConvergence.title')}</h2>
                    <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-300">{t('branchConvergence.body')}</p>
                    <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">{t('branchConvergence.detail')}</p>

                    <button
                        onClick={() => {
                            audio.playSuccess();
                            gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
                        }}
                        className="mt-8 rounded-2xl border border-cyan-400/45 bg-cyan-500/10 px-5 py-4 font-mono text-xs font-bold uppercase tracking-[0.22em] text-cyan-100 transition-colors hover:bg-cyan-500/20"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <ArrowRight size={16} />
                            <span>{t('branchConvergence.continue')}</span>
                        </div>
                    </button>
                </motion.div>
            </div>
        </div>
    );
}