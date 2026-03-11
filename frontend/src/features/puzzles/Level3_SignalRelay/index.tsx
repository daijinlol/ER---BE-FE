import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    Activity,
    Cpu,
    HelpCircle,
    Radio,
    RefreshCcw,
    RotateCcw,
    Send,
    ShieldCheck,
    X,
} from 'lucide-react';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';
import { useGameSession } from '../../../core/GameSession';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../core/gameConstants';
import { usePuzzleValidation } from '../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../types';

type PanelId = 'buffer' | 'pulse' | 'beacon';

type PanelState = Record<PanelId, number[]>;

const TARGETS: PanelState = {
    buffer: [1, 0, 1, 1, 0, 0, 1, 0],
    pulse: [0, 1, 1, 0, 1, 1, 0, 1],
    beacon: [1, 1, 0, 1, 1, 0, 0, 1],
};

const PANEL_ORDER: PanelId[] = ['buffer', 'pulse', 'beacon'];

export default function Level3SignalRelay({ campaignId, levelId }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const { session } = useGameSession();
    const [channels, setChannels] = useState<PanelState>({
        buffer: Array(8).fill(0),
        pulse: Array(8).fill(0),
        beacon: Array(8).fill(0),
    });
    const [hintOpen, setHintOpen] = useState(false);
    const [feedbackKey, setFeedbackKey] = useState<string>('level3.awaitingSignal');
    const [isSolved, setIsSolved] = useState(false);
    const [replayingPanel, setReplayingPanel] = useState<PanelId | null>(null);
    const [replayStep, setReplayStep] = useState<number>(-1);

    const hasRamModule = session.inventoryItems.includes('module_ram');
    const hasLoopModule = session.inventoryItems.includes('module_loop');

    const panelSolved = useMemo(
        () => Object.fromEntries(PANEL_ORDER.map((panelId) => [panelId, arraysMatch(channels[panelId], TARGETS[panelId])])) as Record<PanelId, boolean>,
        [channels],
    );

    const beaconUnlocked = panelSolved.buffer && panelSolved.pulse;
    const allSolved = panelSolved.buffer && panelSolved.pulse && panelSolved.beacon;

    const toggleBit = (panelId: PanelId, index: number) => {
        if (isSolved || replayingPanel) {
            return;
        }

        if (panelId === 'beacon' && !beaconUnlocked) {
            audio.playDeny();
            setFeedbackKey('level3.beaconLocked');
            return;
        }

        audio.playClick();
        setChannels((prev) => ({
            ...prev,
            [panelId]: prev[panelId].map((value, bitIndex) => (bitIndex === index ? (value === 1 ? 0 : 1) : value)),
        }));
        setFeedbackKey(`level3.status.${panelId}`);
    };

    const resetPanel = (panelId: PanelId) => {
        if (isSolved || replayingPanel) {
            return;
        }

        audio.playHover();
        setChannels((prev) => ({
            ...prev,
            [panelId]: Array(8).fill(0),
        }));
    };

    const replayPattern = async (panelId: PanelId) => {
        if (replayingPanel || isSolved) {
            return;
        }

        audio.playHover();
        setFeedbackKey(`level3.replay.${panelId}`);
        setReplayingPanel(panelId);
        setReplayStep(-1);

        for (let index = 0; index < TARGETS[panelId].length; index += 1) {
            setReplayStep(index);
            await wait(220);
        }

        await wait(150);
        setReplayingPanel(null);
        setReplayStep(-1);
    };

    const handleTransmit = async () => {
        if (isSolved || isChecking) {
            return;
        }

        audio.playClick();
        const result = await validate({ channels });

        if (!result.success) {
            audio.playDeny();
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            setFeedbackKey('level3.failedTransmission');
            return;
        }

        audio.playSuccess();
        setIsSolved(true);
        setFeedbackKey('level3.signalRecovered');

        setTimeout(() => {
            setFeedbackKey('level3.archiveLinkReady');
            gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
        }, 2200);
    };

    return (
        <div className="relative flex h-full w-full flex-col items-center overflow-y-auto bg-slate-950 p-3 xl:overflow-hidden xl:p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12)_0%,rgba(2,6,23,1)_55%)] pointer-events-none" />

            <div className="z-10 flex w-full min-h-0 flex-1 cursor-default flex-col gap-3">
                <div className="bg-black/50 border border-cyan-500/20 rounded-xl p-4 backdrop-blur-md shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400" />
                    <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-4">
                            <Radio className="text-cyan-300" size={20} />
                            <div>
                                <h2 className="text-sm font-mono text-slate-100 uppercase tracking-[0.25em]">
                                    {t('level3.title')}
                                </h2>
                                <p className="text-xs font-mono text-slate-500 tracking-wider">
                                    {t('level3.subtitle')}
                                </p>
                            </div>
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

                    <div className="grid md:grid-cols-[1fr_auto] gap-3 items-start">
                        <p className="font-mono text-xs text-cyan-200 border-l-2 border-cyan-400 pl-3 leading-relaxed">
                            {t(feedbackKey)}
                        </p>
                        <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                            <InventoryStatus icon={Cpu} label={t('items.module_ram')} ready={hasRamModule} />
                            <InventoryStatus icon={Activity} label={t('items.module_loop')} ready={hasLoopModule} />
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setHintOpen((prev) => !prev)}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-950/40 border border-cyan-500/20 rounded-lg text-cyan-200 text-xs font-mono tracking-wider hover:bg-cyan-950/60 transition-colors w-full text-left"
                >
                    <HelpCircle size={14} />
                    <span className="flex-1">{t('level3.hintTitle')}</span>
                    <span>{hintOpen ? '−' : '+'}</span>
                </button>
                <AnimatePresence>
                    {hintOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-lg px-4 py-3 text-cyan-100 text-xs font-mono leading-relaxed whitespace-pre-line">
                                {t('level3.hint')}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[1.6fr_0.9fr]">
                    <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-5 shadow-xl flex flex-col gap-4">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {PANEL_ORDER.map((panelId) => (
                                <div
                                    key={panelId}
                                    className={`rounded-xl border p-4 transition-colors ${panelSolved[panelId]
                                            ? 'border-emerald-500/60 bg-emerald-950/20'
                                            : panelId === 'beacon' && !beaconUnlocked
                                                ? 'border-slate-700 bg-slate-950/60 opacity-70'
                                                : 'border-cyan-500/20 bg-slate-950/70'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-mono uppercase tracking-[0.2em] text-slate-100">
                                                {t(`level3.panels.${panelId}.title`)}
                                            </h3>
                                            <p className="mt-1 text-xs text-slate-400 leading-relaxed min-h-10">
                                                {t(`level3.panels.${panelId}.description`)}
                                            </p>
                                        </div>
                                        <ShieldCheck className={panelSolved[panelId] ? 'text-emerald-400' : 'text-slate-600'} size={18} />
                                    </div>

                                    {panelId === 'beacon' ? (
                                        <div className="mt-4 grid grid-cols-4 gap-2">
                                            {channels[panelId].map((bit, index) => (
                                                <BitButton
                                                    key={`${panelId}-${index}`}
                                                    bit={bit}
                                                    flash={isFlashing(panelId, index, replayingPanel, replayStep)}
                                                    disabled={!beaconUnlocked}
                                                    onClick={() => toggleBit(panelId, index)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="mt-4 grid grid-cols-8 gap-2">
                                            {channels[panelId].map((bit, index) => (
                                                <BitButton
                                                    key={`${panelId}-${index}`}
                                                    bit={bit}
                                                    flash={isFlashing(panelId, index, replayingPanel, replayStep)}
                                                    disabled={false}
                                                    onClick={() => toggleBit(panelId, index)}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-4 flex items-center gap-2">
                                        <button
                                            onClick={() => replayPattern(panelId)}
                                            disabled={replayingPanel !== null || (panelId === 'beacon' && !beaconUnlocked)}
                                            className="flex-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-mono uppercase tracking-wider text-cyan-100 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <RefreshCcw size={14} />
                                                <span>{t('level3.replayPattern')}</span>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => resetPanel(panelId)}
                                            disabled={panelId === 'beacon' && !beaconUnlocked}
                                            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                            title={t('level3.resetPanel')}
                                        >
                                            <RotateCcw size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid gap-3 md:grid-cols-3 text-xs font-mono text-slate-400 tracking-wider">
                            <MetricCard label={t('level3.metrics.buffer')} value={panelSolved.buffer ? t('level3.metrics.synced') : t('level3.metrics.pending')} accent={panelSolved.buffer} />
                            <MetricCard label={t('level3.metrics.pulse')} value={panelSolved.pulse ? t('level3.metrics.synced') : t('level3.metrics.pending')} accent={panelSolved.pulse} />
                            <MetricCard label={t('level3.metrics.packet')} value={panelSolved.beacon ? t('level3.metrics.synced') : t('level3.metrics.pending')} accent={panelSolved.beacon} />
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-col gap-4 rounded-xl border border-slate-700 bg-black/40 p-5 shadow-xl xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                        <div>
                            <div className="text-xs font-mono uppercase tracking-[0.22em] text-cyan-300">{t('level3.objectiveTitle')}</div>
                            <p className="mt-2 text-sm text-slate-300 leading-relaxed">{t('level3.objective')}</p>
                        </div>

                        <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">{t('level3.storyTitle')}</div>
                            <p className="mt-2 text-sm text-slate-300 leading-relaxed whitespace-pre-line">{t('level3.story')}</p>
                        </div>

                        <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 flex-1">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">{t('level3.packetPreview')}</div>
                            <div className="mt-4 flex items-center gap-2 flex-wrap">
                                {PANEL_ORDER.map((panelId) => (
                                    <div key={panelId} className="rounded-lg border border-slate-700 px-3 py-2 bg-slate-900/70">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">{t(`level3.panels.${panelId}.short`)}</div>
                                        <div className="flex gap-1">
                                            {channels[panelId].map((bit, index) => (
                                                <div
                                                    key={`${panelId}-preview-${index}`}
                                                    className={`w-3 h-3 rounded-sm border ${bit === 1 ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.45)]' : 'bg-slate-900 border-slate-700'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {(error || !allSolved || isSolved) && (
                            <div className={`rounded-lg border px-4 py-3 text-sm ${isSolved ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200' : 'border-slate-700 bg-slate-950/70 text-slate-300'}`}>
                                {error ?? t(allSolved ? 'level3.readyToTransmit' : 'level3.partialSignal')}
                            </div>
                        )}

                        <button
                            onClick={handleTransmit}
                            disabled={isChecking || isSolved}
                            className="rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-5 py-3 font-mono text-sm font-bold uppercase tracking-[0.25em] text-cyan-100 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Send size={16} />
                                <span>{isChecking ? t('level3.transmitting') : t('level3.transmit')}</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function arraysMatch(a: number[], b: number[]) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}

function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isFlashing(panelId: PanelId, index: number, replayingPanel: PanelId | null, replayStep: number) {
    return replayingPanel === panelId && replayStep === index && TARGETS[panelId][index] === 1;
}

function BitButton({ bit, flash, disabled, onClick }: { bit: number; flash: boolean; disabled: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`aspect-square rounded-lg border transition-all ${flash || bit === 1
                    ? 'border-cyan-300 bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.4)]'
                    : 'border-slate-700 bg-slate-950 hover:border-slate-500'
                } disabled:cursor-not-allowed disabled:opacity-40`}
        />
    );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: boolean }) {
    return (
        <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
            <div className={`mt-2 text-sm ${accent ? 'text-emerald-300' : 'text-slate-300'}`}>{value}</div>
        </div>
    );
}

function InventoryStatus({ icon: Icon, label, ready }: { icon: typeof Cpu; label: string; ready: boolean }) {
    return (
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-[0.16em] ${ready ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200' : 'border-slate-700 bg-slate-900/80 text-slate-500'}`}>
            <Icon size={12} />
            <span>{label}</span>
        </div>
    );
}