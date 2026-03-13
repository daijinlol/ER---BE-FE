import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, FileText, ScanSearch, ArrowRightCircle } from 'lucide-react';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';
import { useGameSession } from '../../../core/GameSession';
import type { PuzzleComponentProps, PuzzleHotspot } from '../types';

export default function RoomEngine({ config, campaignSessionKey }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { session, recordRoomInteraction } = useGameSession();
    const roomSessionKey = `${campaignSessionKey}:${config.id}`;
    const [activeHotspot, setActiveHotspot] = useState<PuzzleHotspot | null>(null);
    const interactionHistory = useMemo(
        () => new Set(session.roomInteractions[roomSessionKey] ?? []),
        [roomSessionKey, session.roomInteractions],
    );

    const visibleHotspots = config.hotspots?.filter((hotspot) => !hotspot.requires || hotspot.requires.every((requirement) => (
        interactionHistory.has(requirement) || session.inventoryItems.includes(requirement)
    ))) ?? [];

    const handleHotspotClick = (hotspot: PuzzleHotspot) => {
        audio.playClick();
        recordRoomInteraction(roomSessionKey, hotspot.id);

        if (hotspot.rewardItem && !session.inventoryItems.includes(hotspot.rewardItem)) {
            gameEvents.publish('ITEM_FOUND', hotspot.rewardItem);
            audio.playItemFound();
        }

        if (hotspot.action === 'LORE') {
            setActiveHotspot(hotspot);
            return;
        }

        if (hotspot.action === 'NEXT_LEVEL') {
            audio.playSuccess();
            gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
        }
    };

    return (
        <div className="group relative h-full w-full overflow-hidden bg-black">
            {config.backgroundUrl ? (
                <div
                    className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-[10s] group-hover:scale-[1.03]"
                    style={{ backgroundImage: `url(${config.backgroundUrl})` }}
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 pointer-events-none">
                    <span className="font-mono text-xl tracking-widest text-slate-700">{t('room.noVisualSignal')}</span>
                </div>
            )}

            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_40%),linear-gradient(to_top,rgba(0,0,0,0.85),rgba(0,0,0,0.18)_45%,rgba(0,0,0,0.75))]" />
            <div className="pointer-events-none absolute inset-0 bg-brand-900/20 mix-blend-overlay" />

            <div className="absolute left-6 top-6 z-20 max-w-md rounded-2xl border border-cyan-400/18 bg-slate-950/55 px-4 py-3 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-2 text-cyan-300">
                    <ScanSearch size={15} />
                    <span className="text-[11px] font-mono uppercase tracking-[0.22em]">{t('room.scanRecovered')}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{t('room.interactHint')}</p>
            </div>

            <div className="absolute inset-0 z-10">
                {visibleHotspots.map((hotspot) => {
                    const isRecovered = interactionHistory.has(hotspot.id);
                    const theme = getHotspotTheme(hotspot.action);
                    const Icon = hotspot.action === 'LORE' ? FileText : ArrowRightCircle;

                    return (
                        <button
                            key={hotspot.id}
                            onClick={() => handleHotspotClick(hotspot)}
                            onMouseEnter={() => audio.playHover()}
                            className="group/spot absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                        >
                            <div className="relative">
                                <div className={`absolute inset-0 rounded-full blur-xl transition-opacity ${theme.glow} opacity-70 group-hover/spot:opacity-100`} />

                                {hotspot.action === 'LORE' ? (
                                    <div className={`relative min-w-[10rem] -rotate-2 rounded-2xl border px-4 py-3 text-left shadow-2xl backdrop-blur-md transition-all group-hover/spot:-translate-y-1 group-hover/spot:rotate-0 ${theme.card}`}>
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-0.5 rounded-xl border p-2 ${theme.iconBox}`}>
                                                <Icon size={16} />
                                            </div>
                                            <div>
                                                <div className={`text-[10px] font-mono uppercase tracking-[0.22em] ${theme.kicker}`}>
                                                    {isRecovered ? t('room.recoveredState') : t('room.newState')}
                                                </div>
                                                <div className="mt-1 text-sm font-medium text-white">{t(hotspot.label)}</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative flex flex-col items-center gap-2">
                                        <div className={`relative flex h-16 w-16 items-center justify-center rounded-full border backdrop-blur-md transition-all group-hover/spot:scale-105 ${theme.card}`}>
                                            <div className={`absolute inset-2 rounded-full border ${theme.ring}`} />
                                            <Icon size={18} className="text-white" />
                                        </div>
                                        <div className={`rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] shadow-lg backdrop-blur-md ${theme.badge}`}>
                                            {t(hotspot.label)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            <AnimatePresence>
                {activeHotspot && activeHotspot.content && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-md"
                        onClick={() => {
                            audio.playClick();
                            setActiveHotspot(null);
                        }}
                    >
                        <motion.div
                            initial={{ y: 40, scale: 0.96 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: 40, scale: 0.96 }}
                            onClick={(event) => event.stopPropagation()}
                            className="relative w-full max-w-2xl overflow-hidden rounded-[1.75rem] border border-slate-700 bg-slate-950/95 shadow-2xl"
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_38%)] pointer-events-none" />
                            <div className="relative border-b border-slate-800 bg-black/35 px-6 py-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-3 text-cyan-300">
                                            <Terminal size={18} />
                                            <span className="text-[11px] font-mono uppercase tracking-[0.22em]">{t('room.loreRecovered')}</span>
                                        </div>
                                        <h3 className="mt-3 text-2xl font-semibold text-white">{t(activeHotspot.label)}</h3>
                                    </div>
                                    <button
                                        onClick={() => {
                                            audio.playClick();
                                            setActiveHotspot(null);
                                        }}
                                        className="rounded-xl border border-slate-700 bg-slate-900/80 p-2 text-slate-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="relative px-6 py-8">
                                <div className="absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.03)_1px,transparent_1px,transparent_4px)] opacity-20 pointer-events-none" />
                                <div className="relative rounded-2xl border border-cyan-400/15 bg-slate-900/70 p-6">
                                    <div className="font-mono text-sm leading-8 text-slate-200 whitespace-pre-line">
                                        {t(activeHotspot.content)}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function getHotspotTheme(action: PuzzleHotspot['action']) {
    if (action === 'NEXT_LEVEL') {
        return {
            glow: 'bg-cyan-400/25',
            card: 'border-cyan-400/35 bg-cyan-500/12 text-cyan-100',
            iconBox: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100',
            kicker: 'text-cyan-200',
            ring: 'border-cyan-300/40',
            badge: 'border-cyan-400/30 bg-slate-950/75 text-cyan-100',
        };
    }

    return {
        glow: 'bg-amber-300/20',
        card: 'border-amber-300/30 bg-slate-950/82 text-amber-100',
        iconBox: 'border-amber-300/25 bg-amber-500/10 text-amber-100',
        kicker: 'text-amber-200',
        ring: 'border-amber-300/35',
        badge: 'border-amber-300/30 bg-slate-950/75 text-amber-100',
    };
}
