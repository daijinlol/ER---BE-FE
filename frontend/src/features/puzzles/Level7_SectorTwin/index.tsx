import { useMemo, useState } from 'react';
import {
    addEdge,
    Background,
    type Connection,
    type Edge,
    Handle,
    MarkerType,
    type Node,
    type NodeProps,
    Position,
    ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnimatePresence, motion } from 'framer-motion';
import { Cpu, HelpCircle, Route, Shuffle, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../core/gameConstants';
import { usePuzzleValidation } from '../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../types';

type HubId = 'hub_life_support' | 'hub_transit' | 'hub_containment';
type StatusId = 'status_safe_state' | 'status_evac_ready';
type ModeId = 'balance_o2' | 'purge_fast' | 'stagger_launch' | 'manual_dispatch' | 'seal_delta' | 'vent_open';

interface TwinNodeData extends Record<string, unknown> {
    title: string;
    body: string;
    variant: 'sensor' | 'hub' | 'status';
    online?: boolean;
}

interface TwinStatus {
    hubs: Record<HubId, boolean>;
    statuses: Record<StatusId, boolean>;
}

const HUB_REQUIREMENTS: Record<HubId, string[]> = {
    hub_life_support: ['sensor_thermal', 'sensor_scrubber'],
    hub_transit: ['sensor_battery', 'sensor_rail'],
    hub_containment: ['sensor_pressure', 'sensor_seal'],
};

const EXPECTED_STATUS_EDGES = {
    status_safe_state: ['hub_life_support', 'hub_containment'],
    status_evac_ready: ['hub_transit'],
} satisfies Record<StatusId, string[]>;

const EXPECTED_MODES: Record<HubId, ModeId> = {
    hub_life_support: 'balance_o2',
    hub_transit: 'stagger_launch',
    hub_containment: 'seal_delta',
};

const MODE_OPTIONS: Record<HubId, ModeId[]> = {
    hub_life_support: ['balance_o2', 'purge_fast'],
    hub_transit: ['stagger_launch', 'manual_dispatch'],
    hub_containment: ['seal_delta', 'vent_open'],
};

const NODE_LAYOUT: Array<Node<TwinNodeData>> = [
    { id: 'sensor_pressure', position: { x: 0, y: 20 }, data: { title: 'level7.nodes.sensor_pressure.title', body: 'level7.nodes.sensor_pressure.body', variant: 'sensor' }, type: 'twin' },
    { id: 'sensor_seal', position: { x: 0, y: 156 }, data: { title: 'level7.nodes.sensor_seal.title', body: 'level7.nodes.sensor_seal.body', variant: 'sensor' }, type: 'twin' },
    { id: 'sensor_thermal', position: { x: 0, y: 292 }, data: { title: 'level7.nodes.sensor_thermal.title', body: 'level7.nodes.sensor_thermal.body', variant: 'sensor' }, type: 'twin' },
    { id: 'sensor_scrubber', position: { x: 0, y: 428 }, data: { title: 'level7.nodes.sensor_scrubber.title', body: 'level7.nodes.sensor_scrubber.body', variant: 'sensor' }, type: 'twin' },
    { id: 'sensor_battery', position: { x: 0, y: 564 }, data: { title: 'level7.nodes.sensor_battery.title', body: 'level7.nodes.sensor_battery.body', variant: 'sensor' }, type: 'twin' },
    { id: 'sensor_rail', position: { x: 0, y: 700 }, data: { title: 'level7.nodes.sensor_rail.title', body: 'level7.nodes.sensor_rail.body', variant: 'sensor' }, type: 'twin' },
    { id: 'hub_containment', position: { x: 360, y: 70 }, data: { title: 'level7.nodes.hub_containment.title', body: 'level7.nodes.hub_containment.body', variant: 'hub' }, type: 'twin' },
    { id: 'hub_life_support', position: { x: 360, y: 270 }, data: { title: 'level7.nodes.hub_life_support.title', body: 'level7.nodes.hub_life_support.body', variant: 'hub' }, type: 'twin' },
    { id: 'hub_transit', position: { x: 360, y: 470 }, data: { title: 'level7.nodes.hub_transit.title', body: 'level7.nodes.hub_transit.body', variant: 'hub' }, type: 'twin' },
    { id: 'status_safe_state', position: { x: 720, y: 180 }, data: { title: 'level7.nodes.status_safe_state.title', body: 'level7.nodes.status_safe_state.body', variant: 'status' }, type: 'twin' },
    { id: 'status_evac_ready', position: { x: 720, y: 430 }, data: { title: 'level7.nodes.status_evac_ready.title', body: 'level7.nodes.status_evac_ready.body', variant: 'status' }, type: 'twin' },
];

const nodeTypes = { twin: TwinNodeCard };

export default function Level7SectorTwin({ campaignId, levelId }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [modes, setModes] = useState<Partial<Record<HubId, ModeId>>>({});
    const [feedbackKey, setFeedbackKey] = useState('level7.awaiting');
    const [hintOpen, setHintOpen] = useState(false);
    const [isSolved, setIsSolved] = useState(false);
    const [runtimeError, setRuntimeError] = useState<string | null>(null);

    const serializedEdges = useMemo(
        () => edges.map((edge) => `${edge.source}->${edge.target}`).sort(),
        [edges],
    );
    const twinStatus = useMemo(() => computeTwinStatus(serializedEdges, modes), [serializedEdges, modes]);
    const nodes = useMemo(
        () => NODE_LAYOUT.map((node) => ({
            ...node,
            draggable: false,
            selectable: false,
            data: {
                ...node.data,
                online: node.id in twinStatus.hubs
                    ? twinStatus.hubs[node.id as HubId]
                    : node.id in twinStatus.statuses
                        ? twinStatus.statuses[node.id as StatusId]
                        : true,
            },
        })),
        [twinStatus],
    );

    const hubSyncCount = Object.values(twinStatus.hubs).filter(Boolean).length;
    const statusSyncCount = Object.values(twinStatus.statuses).filter(Boolean).length;

    const handleConnect = (connection: Connection) => {
        if (isSolved || isChecking || !connection.source || !connection.target) {
            return;
        }

        if (!isAllowedConnection(connection.source, connection.target)) {
            audio.playDeny();
            setFeedbackKey('level7.invalidLink');
            return;
        }

        audio.playClick();
        setRuntimeError(null);
        setEdges((prev) => {
            const filtered = prev.filter((edge) => edge.source !== connection.source);
            return addEdge({
                ...connection,
                id: `${connection.source}-${connection.target}`,
                animated: true,
                markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#67e8f9' },
                style: { stroke: '#67e8f9', strokeWidth: 2.4 },
            }, filtered);
        });
        setFeedbackKey('level7.linked');
    };

    const handleEdgeClick = (_event: React.MouseEvent, edge: Edge) => {
        if (isSolved || isChecking) {
            return;
        }

        audio.playHover();
        setEdges((prev) => prev.filter((item) => item.id !== edge.id));
        setFeedbackKey('level7.unlinked');
    };

    const handleModeChange = (hubId: HubId, modeId: ModeId) => {
        if (isSolved || isChecking) {
            return;
        }

        audio.playClick();
        setRuntimeError(null);
        setModes((prev) => ({ ...prev, [hubId]: modeId }));
        setFeedbackKey('level7.modeUpdated');
    };

    const handleReset = () => {
        if (isSolved || isChecking) {
            return;
        }

        audio.playHover();
        setEdges([]);
        setModes({});
        setRuntimeError(null);
        setFeedbackKey('level7.awaiting');
    };

    const handleValidate = async () => {
        if (isSolved || isChecking) {
            return;
        }

        if (edges.length < 9 || Object.keys(modes).length < 3) {
            audio.playDeny();
            setFeedbackKey('level7.incomplete');
            return;
        }

        audio.playClick();
        const result = await validate({ edges: serializedEdges, modes });

        if (!result.success) {
            audio.playDeny();
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            setFeedbackKey('level7.failure');
            setRuntimeError(result.message || null);
            return;
        }

        audio.playSuccess();
        setRuntimeError(null);
        setIsSolved(true);
        setFeedbackKey('level7.success');

        window.setTimeout(() => {
            result.unlocks.forEach((item) => gameEvents.publish('ITEM_FOUND', item));
            audio.playItemFound();
            setFeedbackKey('level7.unlock');
        }, 1300);

        window.setTimeout(() => {
            gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
        }, 3100);
    };

    return (
        <div className="relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-slate-950 p-3 text-slate-100 xl:p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.12)_0%,rgba(2,6,23,1)_58%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(8,47,73,0.24)_0%,transparent_34%,rgba(59,130,246,0.1)_68%,transparent_100%)]" />

            <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-3 xl:gap-4">
                <div className="shrink-0 overflow-hidden rounded-2xl border border-teal-400/25 bg-black/40 p-4 shadow-2xl backdrop-blur-md">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 text-teal-300">
                                <Sparkles size={18} />
                                <div className="text-xs font-mono uppercase tracking-[0.24em]">{t('level7.subtitle')}</div>
                            </div>
                            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white xl:text-3xl">{t('level7.title')}</h2>
                            <p className="mt-3 max-w-4xl border-l-2 border-teal-400 pl-3 text-sm leading-relaxed text-teal-100">{t(feedbackKey)}</p>
                        </div>
                        <button
                            onClick={() => {
                                audio.playClick();
                                gameEvents.publish('PUZZLE_CLOSED');
                            }}
                            className="rounded border border-transparent p-1 text-slate-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
                            title="Close Interface"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
                    <section className="flex min-h-0 min-w-0 flex-col rounded-[1.75rem] border border-slate-700 bg-slate-950/70 shadow-xl">
                        <div className="grid gap-3 border-b border-slate-800 p-4 sm:grid-cols-4">
                            <TwinStatCard label={t('level7.metrics.sensorLinks')} value={`${edges.length}/9`} accent="teal" />
                            <TwinStatCard label={t('level7.metrics.hubs')} value={`${hubSyncCount}/3`} accent="cyan" />
                            <TwinStatCard label={t('level7.metrics.outputs')} value={`${statusSyncCount}/2`} accent="emerald" />
                            <TwinStatCard label={t('level7.metrics.model')} value={t(statusSyncCount === 2 ? 'level7.metrics.stable' : 'level7.metrics.pending')} accent={statusSyncCount === 2 ? 'emerald' : 'amber'} />
                        </div>

                        <div className="relative min-h-0 flex-1 p-3 xl:p-4">
                            <div className="h-full min-h-[46rem] overflow-hidden rounded-[1.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.12),rgba(2,6,23,1)_68%)]">
                                <ReactFlow
                                    nodes={nodes}
                                    edges={edges}
                                    nodeTypes={nodeTypes}
                                    proOptions={{ hideAttribution: true }}
                                    nodesDraggable={false}
                                    nodesConnectable
                                    elementsSelectable={false}
                                    panOnDrag={false}
                                    zoomOnScroll={false}
                                    zoomOnPinch={false}
                                    zoomOnDoubleClick={false}
                                    fitView
                                    fitViewOptions={{ padding: 0.12 }}
                                    onConnect={handleConnect}
                                    onEdgeClick={handleEdgeClick}
                                >
                                    <Background gap={28} color="rgba(51, 65, 85, 0.45)" />
                                </ReactFlow>
                            </div>
                        </div>
                    </section>

                    <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto rounded-[1.75rem] border border-slate-700 bg-black/35 p-4 shadow-xl custom-scrollbar xl:p-5 xl:pr-3">
                        <div className="rounded-2xl border border-slate-700 bg-slate-950/82 p-4">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-teal-300">{t('level7.objectiveTitle')}</div>
                            <p className="mt-3 text-sm leading-relaxed text-slate-300">{t('level7.objective')}</p>
                        </div>

                        <button
                            onClick={() => setHintOpen((prev) => !prev)}
                            className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/82 px-4 py-3 text-left transition-colors hover:border-teal-400/35"
                        >
                            <HelpCircle size={16} className="text-teal-300" />
                            <span className="flex-1 text-xs font-mono uppercase tracking-[0.2em] text-teal-100">{t('level7.hintTitle')}</span>
                            <span className="text-sm text-slate-400">{hintOpen ? '−' : '+'}</span>
                        </button>
                        <AnimatePresence>
                            {hintOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="min-h-[9rem] rounded-2xl border border-teal-400/20 bg-teal-950/20 px-4 py-4 text-[13px] leading-6 text-teal-100 whitespace-pre-line">
                                        {t('level7.hint')}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="rounded-2xl border border-slate-700 bg-slate-950/82 p-4">
                            <div className="flex items-center gap-2 text-teal-300">
                                <Cpu size={16} />
                                <span className="text-xs font-mono uppercase tracking-[0.2em]">{t('level7.modesTitle')}</span>
                            </div>
                            <div className="mt-4 space-y-3">
                                {(Object.keys(MODE_OPTIONS) as HubId[]).map((hubId) => (
                                    <div key={hubId} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                                        <div className="text-sm font-medium text-white">{t(`level7.modeLabels.${hubId}`)}</div>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                            {MODE_OPTIONS[hubId].map((modeId) => {
                                                const selected = modes[hubId] === modeId;
                                                return (
                                                    <button
                                                        key={modeId}
                                                        onClick={() => handleModeChange(hubId, modeId)}
                                                        className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${selected
                                                            ? 'border-teal-400/60 bg-teal-500/12 text-teal-100'
                                                            : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-teal-400/35'}`}
                                                    >
                                                        {t(`level7.modes.${modeId}`)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                            <button
                                onClick={handleReset}
                                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs uppercase tracking-[0.22em] text-slate-200 transition-colors hover:border-slate-500"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <Shuffle size={15} />
                                    <span>{t('level7.reset')}</span>
                                </div>
                            </button>
                            <button
                                onClick={handleValidate}
                                disabled={isChecking || isSolved}
                                className="rounded-2xl border border-teal-400/45 bg-teal-500/10 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-teal-100 transition-colors hover:bg-teal-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <Route size={15} />
                                    <span>{isChecking ? t('level7.validating') : t('level7.validate')}</span>
                                </div>
                            </button>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-slate-950/76 px-4 py-3 text-sm text-slate-300">
                            {runtimeError ?? error ?? t(isSolved ? 'level7.success' : 'level7.statusHint')}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

function TwinNodeCard({ data }: NodeProps<Node<TwinNodeData>>) {
    const { t } = useTranslation();
    const variantClass = data.variant === 'sensor'
        ? 'border-cyan-400/35 bg-cyan-500/10'
        : data.variant === 'hub'
            ? 'border-teal-400/35 bg-teal-500/10'
            : 'border-emerald-400/35 bg-emerald-500/10';

    return (
        <div className={`relative w-[15rem] rounded-2xl border px-4 py-3 shadow-[0_0_28px_rgba(15,23,42,0.35)] backdrop-blur-md ${variantClass}`}>
            {(data.variant === 'hub' || data.variant === 'status') && (
                <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-slate-950 !bg-teal-300" />
            )}
            {(data.variant === 'sensor' || data.variant === 'hub') && (
                <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-slate-950 !bg-cyan-300" />
            )}

            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400">{data.variant}</div>
                    <div className="mt-1 text-sm font-medium leading-tight text-white">{t(data.title)}</div>
                </div>
                {data.online !== undefined && data.variant !== 'sensor' && (
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${data.online ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-200' : 'border-slate-700 bg-slate-900/80 text-slate-500'}`}>
                        {t(data.online ? 'level7.metrics.stable' : 'level7.metrics.pending')}
                    </span>
                )}
            </div>
            <div className="mt-3 text-xs leading-relaxed text-slate-300">{t(data.body)}</div>
        </div>
    );
}

function isAllowedConnection(source: string, target: string) {
    return (source.startsWith('sensor_') && target.startsWith('hub_')) || (source.startsWith('hub_') && target.startsWith('status_'));
}

function computeTwinStatus(edges: string[], modes: Partial<Record<HubId, ModeId>>): TwinStatus {
    const edgeSet = new Set(edges);

    const hubs = (Object.keys(HUB_REQUIREMENTS) as HubId[]).reduce<Record<HubId, boolean>>((accumulator, hubId) => {
        const hasInputs = HUB_REQUIREMENTS[hubId].every((sensorId) => edgeSet.has(`${sensorId}->${hubId}`));
        accumulator[hubId] = hasInputs && modes[hubId] === EXPECTED_MODES[hubId];
        return accumulator;
    }, {} as Record<HubId, boolean>);

    const statuses = (Object.keys(EXPECTED_STATUS_EDGES) as StatusId[]).reduce<Record<StatusId, boolean>>((accumulator, statusId) => {
        accumulator[statusId] = EXPECTED_STATUS_EDGES[statusId].every((hubId) => hubs[hubId as HubId] && edgeSet.has(`${hubId}->${statusId}`));
        return accumulator;
    }, {} as Record<StatusId, boolean>);

    return { hubs, statuses };
}

function TwinStatCard({ label, value, accent }: { label: string; value: string; accent: 'teal' | 'cyan' | 'emerald' | 'amber' }) {
    const accentClass = accent === 'teal'
        ? 'border-teal-400/35 bg-teal-500/10 text-teal-100'
        : accent === 'cyan'
            ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100'
            : accent === 'emerald'
                ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
                : 'border-amber-400/35 bg-amber-500/10 text-amber-100';

    return (
        <div className={`rounded-2xl border px-4 py-3 ${accentClass}`}>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-300">{label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
        </div>
    );
}