import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownToLine, Cpu, GitMerge, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../core/gameConstants';
import { usePuzzleValidation } from '../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../types';

type JunctionId = 'junction_alpha' | 'junction_beta' | 'junction_gamma';
type RuleId = 'stable' | 'high_priority' | 'amber_tag' | 'archive_tag' | 'low_priority' | 'cyan_tag';
type OutputId = 'bay_a' | 'bay_b' | 'bay_c' | 'bay_d';

interface Packet {
    id: string;
    labelKey: string;
    checksum: 'stable' | 'warning';
    priority: 'high' | 'low';
    tag: 'amber' | 'cyan';
    target: OutputId;
}

const PACKETS: Packet[] = [
    { id: 'iris', labelKey: 'branchRightDecision.packets.iris', checksum: 'stable', priority: 'high', tag: 'amber', target: 'bay_a' },
    { id: 'quill', labelKey: 'branchRightDecision.packets.quill', checksum: 'stable', priority: 'low', tag: 'cyan', target: 'bay_b' },
    { id: 'mako', labelKey: 'branchRightDecision.packets.mako', checksum: 'warning', priority: 'high', tag: 'amber', target: 'bay_c' },
    { id: 'lyra', labelKey: 'branchRightDecision.packets.lyra', checksum: 'warning', priority: 'low', tag: 'cyan', target: 'bay_d' },
];

const JUNCTION_ORDER: JunctionId[] = ['junction_alpha', 'junction_beta', 'junction_gamma'];

const JUNCTION_OPTIONS: Record<JunctionId, RuleId[]> = {
    junction_alpha: ['stable', 'high_priority', 'cyan_tag'],
    junction_beta: ['high_priority', 'low_priority', 'amber_tag'],
    junction_gamma: ['amber_tag', 'cyan_tag', 'stable'],
};

export default function BranchRightDecisionArray({ campaignId, levelId }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const [rules, setRules] = useState<Partial<Record<JunctionId, RuleId>>>({});
    const [feedbackKey, setFeedbackKey] = useState('branchRightDecision.awaiting');
    const [isSolved, setIsSolved] = useState(false);

    const packetOutputs = useMemo(
        () => PACKETS.map((packet) => ({ packet, output: simulatePacket(packet, rules) })),
        [rules],
    );

    const correctlyRouted = packetOutputs.filter(({ packet, output }) => packet.target === output).length;

    const handleRuleSelect = (junctionId: JunctionId, ruleId: RuleId) => {
        if (isSolved || isChecking) {
            return;
        }

        audio.playClick();
        setRules((prev) => ({ ...prev, [junctionId]: ruleId }));
        setFeedbackKey('branchRightDecision.updated');
    };

    const handleValidate = async () => {
        if (isSolved || isChecking) {
            return;
        }

        if (JUNCTION_ORDER.some((junctionId) => !rules[junctionId])) {
            audio.playDeny();
            setFeedbackKey('branchRightDecision.incomplete');
            return;
        }

        audio.playClick();
        const result = await validate({ rules });

        if (!result.success) {
            audio.playDeny();
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            setFeedbackKey('branchRightDecision.failure');
            return;
        }

        audio.playSuccess();
        setIsSolved(true);
        setFeedbackKey('branchRightDecision.success');
        window.setTimeout(() => {
            gameEvents.publish('PUZZLE_SOLVED', { nextLevel: '6_right' });
        }, 1800);
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-slate-950 p-3 text-slate-100 xl:overflow-hidden xl:p-4">
            <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-4">
                <div className="rounded-2xl border border-amber-400/20 bg-black/45 p-4 shadow-2xl backdrop-blur-md">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 text-amber-300">
                                <GitMerge size={18} />
                                <div className="text-xs font-mono uppercase tracking-[0.24em]">{t('branchRightDecision.kicker')}</div>
                            </div>
                            <h2 className="mt-3 text-2xl font-semibold text-white">{t('branchRightDecision.title')}</h2>
                            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">{t('branchRightDecision.story')}</p>
                        </div>
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-right">
                            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-300">{t('branchRightDecision.routed')}</div>
                            <div className="mt-2 text-2xl text-white">{correctlyRouted}/{PACKETS.length}</div>
                        </div>
                    </div>
                    <p className="mt-4 border-l-2 border-amber-400 pl-3 text-sm leading-relaxed text-amber-100">{t(feedbackKey)}</p>
                </div>

                <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[1.08fr_0.92fr]">
                    <div className="rounded-[1.75rem] border border-slate-700 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.1),rgba(2,6,23,1)_58%)] p-5 shadow-xl">
                        <div className="grid gap-4 lg:grid-cols-3">
                            {JUNCTION_ORDER.map((junctionId) => (
                                <div key={junctionId} className="rounded-2xl border border-slate-700 bg-slate-950/78 p-4">
                                    <div className="text-xs font-mono uppercase tracking-[0.2em] text-amber-300">{t(`branchRightDecision.junctions.${junctionId}.title`)}</div>
                                    <p className="mt-2 min-h-14 text-sm leading-relaxed text-slate-300">{t(`branchRightDecision.junctions.${junctionId}.body`)}</p>
                                    <div className="mt-4 grid gap-2">
                                        {JUNCTION_OPTIONS[junctionId].map((ruleId) => {
                                            const selected = rules[junctionId] === ruleId;
                                            return (
                                                <button
                                                    key={ruleId}
                                                    onClick={() => handleRuleSelect(junctionId, ruleId)}
                                                    className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${selected
                                                        ? 'border-amber-300/70 bg-amber-500/15 text-amber-100'
                                                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-amber-400/40'}`}
                                                >
                                                    {t(`branchRightDecision.rules.${ruleId}`)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-5 rounded-2xl border border-slate-700 bg-black/30 p-4">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('branchRightDecision.ruleGuideTitle')}</div>
                            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
                                <li>{t('branchRightDecision.ruleGuide.1')}</li>
                                <li>{t('branchRightDecision.ruleGuide.2')}</li>
                                <li>{t('branchRightDecision.ruleGuide.3')}</li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 xl:min-h-0 xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                        <div className="rounded-2xl border border-slate-700 bg-black/35 p-4 shadow-xl">
                            <div className="flex items-center gap-2 text-amber-300">
                                <Cpu size={16} />
                                <span className="text-xs font-mono uppercase tracking-[0.2em]">{t('branchRightDecision.previewTitle')}</span>
                            </div>
                            <div className="mt-4 space-y-3">
                                {packetOutputs.map(({ packet, output }) => {
                                    const correct = output === packet.target;
                                    return (
                                        <motion.div
                                            key={packet.id}
                                            layout
                                            className={`rounded-2xl border px-4 py-3 ${correct ? 'border-emerald-400/35 bg-emerald-500/10' : 'border-slate-700 bg-slate-950/80'}`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-medium text-white">{t(packet.labelKey)}</div>
                                                    <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
                                                        {t(`branchRightDecision.meta.checksum.${packet.checksum}`)} • {t(`branchRightDecision.meta.priority.${packet.priority}`)} • {t(`branchRightDecision.meta.tag.${packet.tag}`)}
                                                    </div>
                                                </div>
                                                <ShieldCheck size={16} className={correct ? 'text-emerald-300' : 'text-slate-600'} />
                                            </div>
                                            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/75 px-3 py-2 text-xs font-mono uppercase tracking-[0.18em] text-slate-300">
                                                <span>{t('branchRightDecision.currentOutput')}</span>
                                                <span className={correct ? 'text-emerald-300' : 'text-amber-200'}>{t(`branchRightDecision.outputs.${output}`)}</span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-black/35 p-4 shadow-xl">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('branchRightDecision.objectiveTitle')}</div>
                            <p className="mt-3 text-sm leading-relaxed text-slate-300">{t('branchRightDecision.objective')}</p>
                        </div>

                        <div className="grid gap-3 pt-1 sm:grid-cols-2 xl:grid-cols-1">
                            <button
                                onClick={() => {
                                    if (isSolved || isChecking) {
                                        return;
                                    }

                                    audio.playHover();
                                    setRules({});
                                    setFeedbackKey('branchRightDecision.awaiting');
                                }}
                                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs uppercase tracking-[0.22em] text-slate-200 transition-colors hover:border-slate-500"
                            >
                                {t('branchRightDecision.reset')}
                            </button>
                            <button
                                onClick={handleValidate}
                                disabled={isChecking || isSolved}
                                className="rounded-2xl border border-amber-400/45 bg-amber-500/10 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <ArrowDownToLine size={15} />
                                    <span>{isChecking ? t('branchRightDecision.validating') : t('branchRightDecision.validate')}</span>
                                </div>
                            </button>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                            {error ?? t(isSolved ? 'branchRightDecision.success' : 'branchRightDecision.statusHint')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function simulatePacket(packet: Packet, rules: Partial<Record<JunctionId, RuleId>>): OutputId {
    const alpha = evaluateRule(packet, rules.junction_alpha) ? 'beta' : 'gamma';
    if (alpha === 'beta') {
        return evaluateRule(packet, rules.junction_beta) ? 'bay_a' : 'bay_b';
    }

    return evaluateRule(packet, rules.junction_gamma) ? 'bay_c' : 'bay_d';
}

function evaluateRule(packet: Packet, ruleId: RuleId | undefined) {
    switch (ruleId) {
        case 'stable':
            return packet.checksum === 'stable';
        case 'high_priority':
            return packet.priority === 'high';
        case 'low_priority':
            return packet.priority === 'low';
        case 'amber_tag':
            return packet.tag === 'amber';
        case 'cyan_tag':
            return packet.tag === 'cyan';
        case 'archive_tag':
            return packet.tag === 'amber';
        default:
            return false;
    }
}