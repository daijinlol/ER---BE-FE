import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Cpu, GitBranch, type LucideIcon, Map, Trophy, Waypoints } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGameSession } from './GameSession';

interface CampaignDebriefProps {
    campaignId: string;
    onExit: () => void;
}

type DebriefPanel = 'path' | 'systems' | 'learning';

const ROUTE_STAGES = ['airlock', 'loops', 'archive', 'branch', 'twin', 'autopilot'] as const;

export function CampaignDebrief({ campaignId, onExit }: CampaignDebriefProps) {
    const { t } = useTranslation();
    const { session } = useGameSession();
    const [activePanel, setActivePanel] = useState<DebriefPanel>('path');

    const chosenPath = useMemo(() => {
        const interactionKey = `${session.sessionId}:junction_choice`;
        const history = session.roomInteractions[interactionKey] ?? [];
        if (history.includes('right')) {
            return 'right';
        }
        return 'left';
    }, [session.roomInteractions, session.sessionId]);

    const timeRemaining = formatTime(session.timeLeftSeconds);

    return (
        <div className="relative flex h-full w-full items-center justify-center overflow-y-auto bg-slate-950 px-4 py-8 text-slate-100">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),rgba(2,6,23,1)_56%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(34,211,238,0.06),transparent_30%,rgba(251,191,36,0.08)_68%,transparent_100%)]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-6xl rounded-[2rem] border border-cyan-400/25 bg-slate-950/84 p-6 shadow-[0_30px_120px_rgba(2,6,23,0.55)] backdrop-blur-md xl:p-8"
            >
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                    <div>
                        <div className="flex items-center gap-3 text-cyan-300">
                            <Trophy size={20} />
                            <div className="text-xs font-mono uppercase tracking-[0.28em]">{t('campaignDebrief.kicker')}</div>
                        </div>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white xl:text-4xl">{t('campaignDebrief.title')}</h2>
                        <div className="mt-3 text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">
                            {t(`campaigns.${campaignId}.title`, { defaultValue: campaignId })}
                        </div>
                        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300 xl:text-base">{t('campaignDebrief.body')}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                        <DebriefStatCard label={t('campaignDebrief.metrics.time')} value={timeRemaining} icon={Waypoints} accent="cyan" />
                        <DebriefStatCard label={t('campaignDebrief.metrics.modules')} value={`${session.inventoryItems.length}`} icon={Cpu} accent="emerald" />
                        <DebriefStatCard label={t('campaignDebrief.metrics.path')} value={t(`campaignDebrief.paths.${chosenPath}.title`)} icon={GitBranch} accent="amber" />
                    </div>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                    <section className="rounded-[1.75rem] border border-slate-700 bg-slate-950/72 p-5">
                        <div className="flex items-center gap-2 text-cyan-300">
                            <Map size={16} />
                            <div className="text-xs font-mono uppercase tracking-[0.2em]">{t('campaignDebrief.routeTitle')}</div>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-6">
                            {ROUTE_STAGES.map((stageId, index) => {
                                const stageKey = stageId === 'branch' ? `campaignDebrief.route.${chosenPath}` : `campaignDebrief.route.${stageId}`;
                                return (
                                    <div key={stageId} className="relative">
                                        {index < ROUTE_STAGES.length - 1 && (
                                            <div className="absolute left-[calc(100%-0.75rem)] top-1/2 hidden h-[2px] w-[calc(100%+1.5rem)] -translate-y-1/2 bg-gradient-to-r from-cyan-400/60 to-amber-300/50 md:block" />
                                        )}
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.08 }}
                                            className={`relative rounded-2xl border px-4 py-4 ${stageId === 'branch' ? 'border-amber-400/35 bg-amber-500/10' : 'border-cyan-400/25 bg-cyan-500/8'}`}
                                        >
                                            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">{t(`${stageKey}.tag`)}</div>
                                            <div className="mt-2 text-sm font-medium text-white">{t(`${stageKey}.title`)}</div>
                                        </motion.div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className="rounded-[1.75rem] border border-slate-700 bg-slate-950/72 p-5">
                        <div className="flex rounded-2xl border border-slate-700 bg-slate-900/80 p-1">
                            <DebriefTabButton label={t('campaignDebrief.tabs.path')} active={activePanel === 'path'} onClick={() => setActivePanel('path')} />
                            <DebriefTabButton label={t('campaignDebrief.tabs.systems')} active={activePanel === 'systems'} onClick={() => setActivePanel('systems')} />
                            <DebriefTabButton label={t('campaignDebrief.tabs.learning')} active={activePanel === 'learning'} onClick={() => setActivePanel('learning')} />
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activePanel}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="mt-4"
                            >
                                {activePanel === 'path' && (
                                    <div>
                                        <div className="text-xs font-mono uppercase tracking-[0.18em] text-amber-300">{t(`campaignDebrief.paths.${chosenPath}.title`)}</div>
                                        <p className="mt-3 text-sm leading-relaxed text-slate-300">{t(`campaignDebrief.paths.${chosenPath}.body`)}</p>
                                    </div>
                                )}

                                {activePanel === 'systems' && (
                                    <div>
                                        <div className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-300">{t('campaignDebrief.systemsTitle')}</div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {session.inventoryItems.map((itemId) => (
                                                <div key={itemId} className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-mono uppercase tracking-[0.18em] text-cyan-100">
                                                    {t(`items.${itemId}`, { defaultValue: itemId })}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="mt-4 text-sm leading-relaxed text-slate-300">{t('campaignDebrief.systemsBody')}</p>
                                    </div>
                                )}

                                {activePanel === 'learning' && (
                                    <div className="space-y-3">
                                        {[1, 2, 3].map((index) => (
                                            <div key={index} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                                                <div className="flex items-start gap-3">
                                                    <CheckCircle2 size={16} className="mt-0.5 text-emerald-300" />
                                                    <div>
                                                        <div className="text-sm font-medium text-white">{t(`campaignDebrief.learning.${index}.title`)}</div>
                                                        <p className="mt-1 text-sm leading-relaxed text-slate-300">{t(`campaignDebrief.learning.${index}.body`)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </section>
                </div>

                <div className="mt-6 flex flex-col gap-3 rounded-[1.75rem] border border-slate-700 bg-black/25 p-5 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="text-xs font-mono uppercase tracking-[0.2em] text-cyan-300">{t('campaignDebrief.nextDirectiveTitle')}</div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">{t('campaignDebrief.nextDirectiveBody')}</p>
                    </div>
                    <button
                        onClick={onExit}
                        className="rounded-2xl border border-cyan-400/45 bg-cyan-500/10 px-6 py-4 font-mono text-xs font-bold uppercase tracking-[0.22em] text-cyan-100 transition-colors hover:bg-cyan-500/20"
                    >
                        {t('campaignDebrief.exit')}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

function DebriefStatCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: LucideIcon; accent: 'cyan' | 'emerald' | 'amber' }) {
    const accentClass = accent === 'cyan'
        ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100'
        : accent === 'emerald'
            ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
            : 'border-amber-400/35 bg-amber-500/10 text-amber-100';

    return (
        <div className={`rounded-2xl border px-4 py-3 ${accentClass}`}>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-300">
                <Icon size={14} />
                <span>{label}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
        </div>
    );
}

function DebriefTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-mono uppercase tracking-[0.18em] transition-colors ${active ? 'bg-cyan-500/14 text-cyan-100' : 'text-slate-400 hover:text-slate-200'}`}
        >
            {label}
        </button>
    );
}

function formatTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}