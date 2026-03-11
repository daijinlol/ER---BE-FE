import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FileWarning, FolderOpen, Lock, Map, RadioTower, Unlock, X } from 'lucide-react';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';
import { useGameSession } from '../../../core/GameSession';
import type { PuzzleComponentProps } from '../types';

type StoryNodeId = 'response' | 'supervisor' | 'transit';

const STORY_ORDER: StoryNodeId[] = ['response', 'supervisor', 'transit'];

const STORY_ICONS = {
    response: RadioTower,
    supervisor: FileWarning,
    transit: Map,
} satisfies Record<StoryNodeId, typeof RadioTower>;

export default function ArchiveBridge(_props: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { session } = useGameSession();
    const [activeNode, setActiveNode] = useState<StoryNodeId>('response');
    const [revealedNodes, setRevealedNodes] = useState<StoryNodeId[]>(['response']);

    const hasDecryptor = session.inventoryItems.includes('usb_decryptor');
    const allUnlocked = revealedNodes.length === STORY_ORDER.length;

    const nodeReady = useMemo(
        () => ({
            response: true,
            supervisor: revealedNodes.includes('response'),
            transit: revealedNodes.includes('supervisor'),
        }),
        [revealedNodes],
    );

    const unlockNext = () => {
        const currentIndex = STORY_ORDER.indexOf(activeNode);
        if (currentIndex === -1) {
            return;
        }

        const nextNode = STORY_ORDER[currentIndex + 1];
        if (!nextNode) {
            return;
        }

        audio.playSuccess();
        setRevealedNodes((prev) => (prev.includes(nextNode) ? prev : [...prev, nextNode]));
        setActiveNode(nextNode);
    };

    const handleOpenNode = (nodeId: StoryNodeId) => {
        if (!nodeReady[nodeId] || !revealedNodes.includes(nodeId)) {
            audio.playDeny();
            return;
        }

        audio.playClick();
        setActiveNode(nodeId);
    };

    const handleProceed = () => {
        audio.playClick();
        gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
    };

    const currentIndex = STORY_ORDER.indexOf(activeNode);
    const nextNode = STORY_ORDER[currentIndex + 1];

    return (
        <div className="relative h-full w-full overflow-y-auto bg-slate-950 p-3 xl:overflow-hidden xl:p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.1)_0%,rgba(2,6,23,1)_60%)] pointer-events-none" />
            <div className="relative z-10 flex h-full min-h-0 flex-col gap-4">
                <div className="bg-black/45 border border-emerald-500/20 rounded-xl p-4 backdrop-blur-md shadow-2xl">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-sm font-mono uppercase tracking-[0.24em] text-emerald-100">{t('archiveBridge.title')}</h2>
                            <p className="mt-1 text-xs font-mono tracking-wider text-slate-500">{t('archiveBridge.subtitle')}</p>
                        </div>
                        <button
                            onClick={() => {
                                audio.playClick();
                                gameEvents.publish('PUZZLE_CLOSED');
                            }}
                            className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/50"
                            title="Close Interface"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[0.9fr_1.4fr]">
                    <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-5 shadow-xl flex flex-col gap-4">
                        <div>
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-300">{t('archiveBridge.channelStatus')}</div>
                            <div className="mt-3 space-y-3">
                                {STORY_ORDER.map((nodeId) => {
                                    const Icon = STORY_ICONS[nodeId];
                                    const revealed = revealedNodes.includes(nodeId);
                                    const ready = nodeReady[nodeId] && revealed;

                                    return (
                                        <button
                                            key={nodeId}
                                            onClick={() => handleOpenNode(nodeId)}
                                            className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${activeNode === nodeId ? 'border-emerald-400/60 bg-emerald-950/25' : 'border-slate-700 bg-slate-950/70'} ${ready ? 'hover:border-emerald-400/40' : 'cursor-not-allowed opacity-75'}`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <Icon size={16} className={ready ? 'text-emerald-300' : 'text-slate-600'} />
                                                    <div>
                                                        <div className="text-xs font-mono uppercase tracking-[0.18em] text-slate-200">{t(`archiveBridge.nodes.${nodeId}.title`)}</div>
                                                        <div className="mt-1 text-xs text-slate-500">{t(`archiveBridge.nodes.${nodeId}.tag`)}</div>
                                                    </div>
                                                </div>
                                                {ready ? <Unlock size={14} className="text-emerald-300" /> : <Lock size={14} className="text-slate-600" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 text-sm leading-relaxed text-slate-300">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('archiveBridge.inventoryTitle')}</div>
                            <div className="mt-3 grid gap-2 text-xs font-mono uppercase tracking-[0.16em]">
                                <InventoryLine label={t('items.module_ram')} ready={session.inventoryItems.includes('module_ram')} />
                                <InventoryLine label={t('items.module_loop')} ready={session.inventoryItems.includes('module_loop')} />
                                <InventoryLine label={t('items.usb_decryptor')} ready={hasDecryptor} />
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 text-sm leading-relaxed text-slate-300 whitespace-pre-line">
                            {t('archiveBridge.summary')}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 rounded-xl border border-slate-700 bg-black/45 p-5 shadow-xl xl:min-h-0 xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                        <motion.div
                            key={activeNode}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border border-emerald-500/20 bg-slate-950/85 p-5 min-h-[340px]"
                        >
                            <div className="text-xs font-mono uppercase tracking-[0.22em] text-emerald-300">{t(`archiveBridge.nodes.${activeNode}.heading`)}</div>
                            <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-300">{t(`archiveBridge.nodes.${activeNode}.body`)}</div>
                        </motion.div>

                        {nextNode && !revealedNodes.includes(nextNode) && (
                            <button
                                onClick={unlockNext}
                                className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-5 py-3 font-mono text-sm font-bold uppercase tracking-[0.22em] text-emerald-100 transition-colors hover:bg-emerald-500/20"
                            >
                                {t(`archiveBridge.actions.${nextNode}`)}
                            </button>
                        )}

                        {allUnlocked && (
                            <button
                                onClick={handleProceed}
                                className="rounded-xl border border-cyan-400/50 bg-cyan-500/10 px-5 py-3 font-mono text-sm font-bold uppercase tracking-[0.22em] text-cyan-100 transition-colors hover:bg-cyan-500/20"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <FolderOpen size={16} />
                                    <span>{t('archiveBridge.openHub')}</span>
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function InventoryLine({ label, ready }: { label: string; ready: boolean }) {
    return (
        <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${ready ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200' : 'border-slate-700 bg-slate-900/80 text-slate-500'}`}>
            <span>{label}</span>
            <span>{ready ? 'ONLINE' : 'MISSING'}</span>
        </div>
    );
}