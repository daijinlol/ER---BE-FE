import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Cpu, GitBranch, type LucideIcon, Map, Trophy, Waypoints } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGameSession } from './GameSession';
import { registry } from '../features/puzzles/registry';
import { getCampaignTheme, withAlpha } from './campaignTheme';

interface CampaignDebriefProps {
    campaignId: string;
    onExit: () => void;
}

type DebriefPanel = 'path' | 'systems' | 'learning';

export function CampaignDebrief({ campaignId, onExit }: CampaignDebriefProps) {
    const { t, i18n } = useTranslation();
    const { session } = useGameSession();
    const [activePanel, setActivePanel] = useState<DebriefPanel>('path');
    const campaign = registry.campaigns[campaignId];
    const theme = getCampaignTheme(campaignId);
    const routeStages = campaign?.debrief?.routeStages ?? [];
    const branchConfig = campaign?.debrief?.branch;
    const pathDecisionLevelId = campaign?.debrief?.pathDecisionLevelId;
    const resultDecisionLevelId = campaign?.debrief?.resultDecisionLevelId;

    const chosenPath = useMemo(() => {
        if (pathDecisionLevelId) {
            return session.decisionOutcomes[pathDecisionLevelId]
                ?? campaign?.debrief?.defaultPath
                ?? 'left';
        }

        if (!branchConfig) {
            return campaign?.debrief?.defaultPath ?? 'left';
        }

        const interactionKey = `${session.sessionId}:${branchConfig.interactionKey}`;
        const history = session.roomInteractions[interactionKey] ?? [];
        if (history.includes('right')) {
            return 'right';
        }
        return branchConfig.defaultPath;
    }, [branchConfig, campaign?.debrief?.defaultPath, pathDecisionLevelId, session.decisionOutcomes, session.roomInteractions, session.sessionId]);

    const resultOutcome = useMemo(() => {
        if (!resultDecisionLevelId) {
            return null;
        }

        return session.decisionOutcomes[resultDecisionLevelId]
            ?? campaign?.debrief?.defaultResult
            ?? null;
    }, [campaign?.debrief?.defaultResult, resultDecisionLevelId, session.decisionOutcomes]);

    const timeRemaining = formatTime(session.timeLeftSeconds);

    const resolveCampaignCopy = (relativeKey: string, fallbackKey: string) => {
        const campaignKey = `campaignDebriefCampaigns.${campaignId}.${relativeKey}`;
        return i18n.exists(campaignKey) ? t(campaignKey) : t(fallbackKey);
    };

    return (
        <div className="relative flex h-full w-full items-center justify-center overflow-y-auto bg-slate-950 px-4 py-8 text-slate-100">
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at top, ${withAlpha(theme.primary, 0.18)}, rgba(2,6,23,1) 56%)` }} />
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${withAlpha(theme.secondary, 0.08)}, transparent 30%, ${withAlpha(theme.primary, 0.12)} 68%, transparent 100%)` }} />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-6xl rounded-[2rem] border bg-slate-950/84 p-6 shadow-[0_30px_120px_rgba(2,6,23,0.55)] backdrop-blur-md xl:p-8"
                style={{ borderColor: withAlpha(theme.primary, 0.25) }}
            >
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                    <div>
                        <div className="flex items-center gap-3" style={{ color: theme.secondary }}>
                            <Trophy size={20} />
                            <div className="text-xs font-mono uppercase tracking-[0.28em]">{t('campaignDebrief.kicker')}</div>
                        </div>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white xl:text-4xl">{resolveCampaignCopy('title', 'campaignDebrief.title')}</h2>
                        <div className="mt-3 text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">
                            {t(`campaigns.${campaignId}.title`, { defaultValue: campaignId })}
                        </div>
                        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300 xl:text-base">{resolveCampaignCopy('body', 'campaignDebrief.body')}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                        <DebriefStatCard label={t('campaignDebrief.metrics.time')} value={timeRemaining} icon={Waypoints} accent={theme} />
                        <DebriefStatCard label={t('campaignDebrief.metrics.modules')} value={`${session.inventoryItems.length}`} icon={Cpu} accent="emerald" />
                        <DebriefStatCard label={t('campaignDebrief.metrics.path')} value={resolveCampaignCopy(`paths.${chosenPath}.title`, `campaignDebrief.paths.${chosenPath}.title`)} icon={GitBranch} accent="amber" />
                        {resultOutcome && (
                            <DebriefStatCard label={t('campaignDebrief.metrics.outcome', { defaultValue: 'Outcome' })} value={resolveCampaignCopy(`results.${resultOutcome}.title`, 'campaignDebrief.metrics.outcome')} icon={CheckCircle2} accent="emerald" />
                        )}
                    </div>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                    <section className="rounded-[1.75rem] border border-slate-700 bg-slate-950/72 p-5">
                        <div className="flex items-center gap-2" style={{ color: theme.secondary }}>
                            <Map size={16} />
                            <div className="text-xs font-mono uppercase tracking-[0.2em]">{t('campaignDebrief.routeTitle')}</div>
                        </div>

                        <div
                            className="mt-5 grid gap-4"
                            style={{ gridTemplateColumns: routeStages.length > 0 ? `repeat(${Math.min(routeStages.length, 6)}, minmax(0, 1fr))` : undefined }}
                        >
                            {routeStages.map((stageId, index) => {
                                const stageRelativeKey = stageId === 'branch' ? `route.${chosenPath}` : `route.${stageId}`;
                                const stageKey = stageId === 'branch' ? `campaignDebrief.route.${chosenPath}` : `campaignDebrief.route.${stageId}`;
                                return (
                                    <div key={stageId} className="relative">
                                        {index < routeStages.length - 1 && (
                                            <div className="absolute left-[calc(100%-0.75rem)] top-1/2 hidden h-[2px] w-[calc(100%+1.5rem)] -translate-y-1/2 md:block" style={{ backgroundImage: `linear-gradient(90deg, ${withAlpha(theme.secondary, 0.7)}, ${withAlpha(theme.primary, 0.4)})` }} />
                                        )}
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.08 }}
                                            className="relative rounded-2xl border px-4 py-4"
                                            style={stageId === 'branch'
                                                ? { borderColor: 'rgba(251,191,36,0.35)', backgroundColor: 'rgba(245,158,11,0.1)' }
                                                : { borderColor: withAlpha(theme.primary, 0.28), backgroundColor: withAlpha(theme.primary, 0.08) }}
                                        >
                                            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">{resolveCampaignCopy(`${stageRelativeKey}.tag`, `${stageKey}.tag`)}</div>
                                            <div className="mt-2 text-sm font-medium text-white">{resolveCampaignCopy(`${stageRelativeKey}.title`, `${stageKey}.title`)}</div>
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
                                        <div className="text-xs font-mono uppercase tracking-[0.18em] text-amber-300">{resolveCampaignCopy(`paths.${chosenPath}.title`, `campaignDebrief.paths.${chosenPath}.title`)}</div>
                                        <p className="mt-3 text-sm leading-relaxed text-slate-300">{resolveCampaignCopy(`paths.${chosenPath}.body`, `campaignDebrief.paths.${chosenPath}.body`)}</p>
                                        {resultOutcome && (
                                            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                                                <div className="text-xs font-mono uppercase tracking-[0.18em] text-emerald-300">{resolveCampaignCopy(`results.${resultOutcome}.title`, 'campaignDebrief.metrics.outcome')}</div>
                                                <p className="mt-2 text-sm leading-relaxed text-slate-300">{resolveCampaignCopy(`results.${resultOutcome}.body`, 'campaignDebrief.body')}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activePanel === 'systems' && (
                                    <div>
                                        <div className="text-xs font-mono uppercase tracking-[0.18em]" style={{ color: theme.secondary }}>{resolveCampaignCopy('systemsTitle', 'campaignDebrief.systemsTitle')}</div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {session.inventoryItems.map((itemId) => (
                                                <div
                                                    key={itemId}
                                                    className="rounded-full border px-3 py-2 text-xs font-mono uppercase tracking-[0.18em]"
                                                    style={{ borderColor: withAlpha(theme.primary, 0.3), backgroundColor: withAlpha(theme.primary, 0.12), color: '#e2e8f0' }}
                                                >
                                                    {t(`items.${itemId}`, { defaultValue: itemId })}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="mt-4 text-sm leading-relaxed text-slate-300">{resolveCampaignCopy('systemsBody', 'campaignDebrief.systemsBody')}</p>
                                    </div>
                                )}

                                {activePanel === 'learning' && (
                                    <div className="space-y-3">
                                        {[1, 2, 3].map((index) => (
                                            <div key={index} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                                                <div className="flex items-start gap-3">
                                                    <CheckCircle2 size={16} className="mt-0.5 text-emerald-300" />
                                                    <div>
                                                        <div className="text-sm font-medium text-white">{resolveCampaignCopy(`learning.${index}.title`, `campaignDebrief.learning.${index}.title`)}</div>
                                                        <p className="mt-1 text-sm leading-relaxed text-slate-300">{resolveCampaignCopy(`learning.${index}.body`, `campaignDebrief.learning.${index}.body`)}</p>
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
                        <div className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: theme.secondary }}>{resolveCampaignCopy('nextDirectiveTitle', 'campaignDebrief.nextDirectiveTitle')}</div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300">{resolveCampaignCopy('nextDirectiveBody', 'campaignDebrief.nextDirectiveBody')}</p>
                    </div>
                    <button
                        onClick={onExit}
                        className="rounded-2xl border px-6 py-4 font-mono text-xs font-bold uppercase tracking-[0.22em] transition-colors"
                        style={{ borderColor: withAlpha(theme.primary, 0.45), backgroundColor: withAlpha(theme.primary, 0.1), color: '#f8fafc' }}
                    >
                        {t('campaignDebrief.exit')}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

function DebriefStatCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: LucideIcon; accent: { primary: string; secondary: string } | 'emerald' | 'amber' }) {
    const accentStyle = typeof accent === 'string'
        ? accent === 'emerald'
            ? { borderColor: 'rgba(52,211,153,0.35)', backgroundColor: 'rgba(16,185,129,0.1)', color: '#d1fae5' }
            : { borderColor: 'rgba(251,191,36,0.35)', backgroundColor: 'rgba(245,158,11,0.1)', color: '#fef3c7' }
        : { borderColor: withAlpha(accent.primary, 0.35), backgroundColor: withAlpha(accent.primary, 0.1), color: accent.secondary };

    return (
        <div className="rounded-2xl border px-4 py-3" style={accentStyle}>
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