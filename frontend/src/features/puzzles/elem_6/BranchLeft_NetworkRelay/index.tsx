import { useMemo, useState } from 'react';
import { Network, RotateCcw, ScanSearch, SendHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../../core/AudioEngine';
import { gameEvents } from '../../../../core/EventBus';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../../core/gameConstants';
import { usePuzzleValidation } from '../../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../../types';

interface RelayNode {
    id: string;
    x: number;
    y: number;
    labelKey: string;
    band: 'amber' | 'cyan' | 'optical';
    latency: number;
    stability: 'stable' | 'unstable';
    checksum: 'odd' | 'even';
}

const NODES: RelayNode[] = [
    { id: 'ingress', x: 10, y: 50, labelKey: 'branchLeftRelay.nodes.ingress', band: 'optical', latency: 0, stability: 'stable', checksum: 'even' },
    { id: 'relay_a', x: 28, y: 18, labelKey: 'branchLeftRelay.nodes.relay_a', band: 'amber', latency: 4, stability: 'stable', checksum: 'odd' },
    { id: 'relay_b', x: 28, y: 50, labelKey: 'branchLeftRelay.nodes.relay_b', band: 'cyan', latency: 7, stability: 'stable', checksum: 'odd' },
    { id: 'relay_c', x: 28, y: 82, labelKey: 'branchLeftRelay.nodes.relay_c', band: 'cyan', latency: 3, stability: 'unstable', checksum: 'even' },
    { id: 'relay_d', x: 50, y: 18, labelKey: 'branchLeftRelay.nodes.relay_d', band: 'cyan', latency: 2, stability: 'stable', checksum: 'odd' },
    { id: 'relay_e', x: 50, y: 50, labelKey: 'branchLeftRelay.nodes.relay_e', band: 'amber', latency: 1, stability: 'stable', checksum: 'even' },
    { id: 'relay_f', x: 50, y: 82, labelKey: 'branchLeftRelay.nodes.relay_f', band: 'cyan', latency: 5, stability: 'unstable', checksum: 'even' },
    { id: 'relay_g', x: 72, y: 32, labelKey: 'branchLeftRelay.nodes.relay_g', band: 'optical', latency: 4, stability: 'stable', checksum: 'odd' },
    { id: 'relay_h', x: 72, y: 68, labelKey: 'branchLeftRelay.nodes.relay_h', band: 'optical', latency: 6, stability: 'stable', checksum: 'even' },
    { id: 'egress', x: 90, y: 50, labelKey: 'branchLeftRelay.nodes.egress', band: 'optical', latency: 0, stability: 'stable', checksum: 'even' },
];

const LINKS: Array<[string, string]> = [
    ['ingress', 'relay_a'],
    ['ingress', 'relay_b'],
    ['ingress', 'relay_c'],
    ['relay_a', 'relay_d'],
    ['relay_a', 'relay_e'],
    ['relay_b', 'relay_d'],
    ['relay_b', 'relay_e'],
    ['relay_b', 'relay_f'],
    ['relay_c', 'relay_e'],
    ['relay_c', 'relay_f'],
    ['relay_d', 'relay_g'],
    ['relay_d', 'relay_h'],
    ['relay_e', 'relay_g'],
    ['relay_e', 'relay_h'],
    ['relay_f', 'relay_h'],
    ['relay_g', 'egress'],
    ['relay_h', 'egress'],
];

const ADJACENCY = LINKS.reduce<Record<string, string[]>>((map, [left, right]) => {
    map[left] = [...(map[left] ?? []), right];
    map[right] = [...(map[right] ?? []), left];
    return map;
}, {});

export default function BranchLeftNetworkRelay({ campaignId, levelId }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const [route, setRoute] = useState<string[]>(['ingress']);
    const [feedbackKey, setFeedbackKey] = useState('branchLeftRelay.awaiting');
    const [isSolved, setIsSolved] = useState(false);
    const [focusedNodeId, setFocusedNodeId] = useState<string>('relay_b');

    const activeEdges = useMemo(() => new Set(route.slice(1).map((nodeId, index) => serializeEdge(route[index], nodeId))), [route]);
    const currentNode = route[route.length - 1];
    const availableNodes = new Set(ADJACENCY[currentNode] ?? []);
    const focusedNode = NODES.find((node) => node.id === focusedNodeId) ?? NODES[1];

    const handleNodeClick = (nodeId: string) => {
        if (isSolved || isChecking) {
            return;
        }

        setFocusedNodeId(nodeId);

        if (nodeId === currentNode && route.length === 1) {
            return;
        }

        if (route.length > 1 && nodeId === route[route.length - 2]) {
            audio.playHover();
            setRoute((prev) => prev.slice(0, -1));
            setFeedbackKey('branchLeftRelay.backtracked');
            return;
        }

        if (!availableNodes.has(nodeId) || route.includes(nodeId)) {
            audio.playDeny();
            setFeedbackKey('branchLeftRelay.invalidStep');
            return;
        }

        audio.playClick();
        setRoute((prev) => [...prev, nodeId]);
        setFeedbackKey(nodeId === 'egress' ? 'branchLeftRelay.ready' : 'branchLeftRelay.progress');
    };

    const handleReset = () => {
        if (isSolved || isChecking) {
            return;
        }

        audio.playHover();
        setRoute(['ingress']);
        setFeedbackKey('branchLeftRelay.awaiting');
    };

    const handleTransmit = async () => {
        if (isSolved || isChecking) {
            return;
        }

        audio.playClick();
        const result = await validate({ route });

        if (!result.success) {
            audio.playDeny();
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            setFeedbackKey('branchLeftRelay.failure');
            return;
        }

        audio.playSuccess();
        setIsSolved(true);
        setFeedbackKey('branchLeftRelay.success');
        window.setTimeout(() => {
            gameEvents.publish('PUZZLE_SOLVED', { nextLevel: '6_left' });
        }, 1800);
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-slate-950 p-3 text-slate-100 xl:overflow-hidden xl:p-4">
            <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-4">
                <div className="rounded-2xl border border-cyan-400/20 bg-black/40 p-3 shadow-2xl backdrop-blur-md">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 text-cyan-300">
                                <Network size={18} />
                                <div className="text-xs font-mono uppercase tracking-[0.24em]">{t('branchLeftRelay.kicker')}</div>
                            </div>
                            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white xl:text-[1.65rem]">{t('branchLeftRelay.title')}</h2>
                            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300 xl:text-[13px]">{t('branchLeftRelay.story')}</p>
                        </div>
                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-right">
                            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-300">{t('branchLeftRelay.routeLength')}</div>
                            <div className="mt-2 text-2xl text-white">{route.length}</div>
                        </div>
                    </div>
                    <p className="mt-4 border-l-2 border-cyan-400 pl-3 text-sm leading-relaxed text-cyan-100">{t(feedbackKey)}</p>
                </div>

                <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[1.4fr_0.8fr]">
                    <div className="relative min-h-[560px] overflow-hidden rounded-[1.75rem] border border-slate-700 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),rgba(2,6,23,1)_60%)] p-5 shadow-xl xl:min-h-[520px] xl:p-4">
                        <div className="absolute inset-x-4 top-4 z-10 rounded-2xl border border-cyan-400/15 bg-slate-950/55 px-4 py-2.5 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-cyan-300">
                                <ScanSearch size={15} />
                                <span className="text-[11px] font-mono uppercase tracking-[0.22em]">{t('branchLeftRelay.boardTitle')}</span>
                            </div>
                            <p className="mt-1.5 text-sm leading-relaxed text-slate-300 xl:text-[13px]">{t('branchLeftRelay.boardHint')}</p>
                        </div>

                        <div className="absolute inset-x-0 bottom-0 top-24 xl:top-22">
                        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
                            {LINKS.map(([leftId, rightId]) => {
                                const leftNode = NODES.find((node) => node.id === leftId);
                                const rightNode = NODES.find((node) => node.id === rightId);

                                if (!leftNode || !rightNode) {
                                    return null;
                                }

                                const active = activeEdges.has(serializeEdge(leftId, rightId));

                                return (
                                    <path
                                        key={`${leftId}-${rightId}`}
                                        d={buildLinkPath(leftNode, rightNode)}
                                        stroke={active ? '#67e8f9' : 'rgba(71,85,105,0.7)'}
                                        strokeWidth={active ? 2.2 : 1.2}
                                        strokeDasharray={active ? '0' : '5 6'}
                                        fill="none"
                                        strokeLinecap="round"
                                    />
                                );
                            })}
                        </svg>

                        {NODES.map((node) => {
                            const isVisited = route.includes(node.id);
                            const isCurrent = currentNode === node.id;
                            const isAvailable = availableNodes.has(node.id);
                            const isFocused = focusedNodeId === node.id;

                            return (
                                <button
                                    key={node.id}
                                    onClick={() => handleNodeClick(node.id)}
                                    onMouseEnter={() => setFocusedNodeId(node.id)}
                                    className={`absolute z-10 flex h-[4.35rem] w-[4.35rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border text-center transition-all xl:h-[4rem] xl:w-[4rem] ${isCurrent
                                        ? 'border-cyan-200 bg-cyan-400/22 shadow-[0_0_28px_rgba(34,211,238,0.36)]'
                                        : isVisited
                                            ? 'border-emerald-300/60 bg-emerald-500/16'
                                            : isAvailable
                                                ? 'border-slate-500 bg-slate-900/80 hover:border-cyan-300/60 hover:bg-cyan-500/10'
                                                : 'border-slate-700 bg-slate-950/82'} ${isFocused ? 'ring-2 ring-cyan-300/50' : ''}`}
                                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                                >
                                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                                        {node.id === 'ingress' || node.id === 'egress' ? node.id.slice(0, 3) : node.id.replace('relay_', 'R-')}
                                    </span>
                                    <span className="mt-1 px-2 text-[10px] leading-tight text-slate-100 xl:text-[9px]">{t(node.labelKey)}</span>
                                </button>
                            );
                        })}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                        <div className="rounded-2xl border border-slate-700 bg-black/35 p-4 shadow-xl">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-cyan-300">{t('branchLeftRelay.objectiveTitle')}</div>
                            <p className="mt-3 text-sm leading-relaxed text-slate-300">{t('branchLeftRelay.objective')}</p>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-black/35 p-4 shadow-xl">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('branchLeftRelay.currentPath')}</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {route.map((nodeId, index) => (
                                    <div key={`${nodeId}-${index}`} className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs font-mono uppercase tracking-[0.18em] text-cyan-100">
                                        {t(`branchLeftRelay.nodes.${nodeId}`)}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-black/35 p-4 shadow-xl">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('branchLeftRelay.rulesTitle')}</div>
                            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
                                <li>{t('branchLeftRelay.rules.1')}</li>
                                <li>{t('branchLeftRelay.rules.2')}</li>
                                <li>{t('branchLeftRelay.rules.3')}</li>
                                <li>{t('branchLeftRelay.rules.4')}</li>
                            </ul>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-black/35 p-4 shadow-xl">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('branchLeftRelay.relayDetailsTitle')}</div>
                            <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-4">
                                <div className="text-sm font-medium text-white">{t(focusedNode.labelKey)}</div>
                                <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">{focusedNode.id}</div>
                                <div className="mt-4 grid gap-2 text-sm">
                                    <DetailRow label={t('branchLeftRelay.detailLabels.band')} value={t(`branchLeftRelay.detailValues.band.${focusedNode.band}`)} />
                                    <DetailRow label={t('branchLeftRelay.detailLabels.latency')} value={t('branchLeftRelay.detailValues.latency', { value: focusedNode.latency })} />
                                    <DetailRow label={t('branchLeftRelay.detailLabels.stability')} value={t(`branchLeftRelay.detailValues.stability.${focusedNode.stability}`)} />
                                    <DetailRow label={t('branchLeftRelay.detailLabels.checksum')} value={t(`branchLeftRelay.detailValues.checksum.${focusedNode.checksum}`)} />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 pt-1 sm:grid-cols-2 xl:grid-cols-1">
                            <button
                                onClick={handleReset}
                                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs uppercase tracking-[0.22em] text-slate-200 transition-colors hover:border-slate-500"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <RotateCcw size={15} />
                                    <span>{t('branchLeftRelay.reset')}</span>
                                </div>
                            </button>
                            <button
                                onClick={handleTransmit}
                                disabled={isChecking || isSolved}
                                className="rounded-2xl border border-cyan-400/45 bg-cyan-500/10 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-cyan-100 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <SendHorizontal size={15} />
                                    <span>{isChecking ? t('branchLeftRelay.validating') : t('branchLeftRelay.validate')}</span>
                                </div>
                            </button>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                            {error ?? t(isSolved ? 'branchLeftRelay.success' : 'branchLeftRelay.statusHint')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function serializeEdge(leftId: string, rightId: string) {
    return [leftId, rightId].sort().join(':');
}

function buildLinkPath(leftNode: RelayNode, rightNode: RelayNode) {
    const controlX = (leftNode.x + rightNode.x) / 2;
    return `M ${leftNode.x} ${leftNode.y} C ${controlX} ${leftNode.y} ${controlX} ${rightNode.y} ${rightNode.x} ${rightNode.y}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2">
            <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">{label}</span>
            <span className="text-sm text-slate-200">{value}</span>
        </div>
    );
}