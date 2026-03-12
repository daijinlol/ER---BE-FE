import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Gauge, HelpCircle, Play, RefreshCcw, Repeat, Wrench, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../core/gameConstants';
import { usePuzzleValidation } from '../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../types';

type CommandId = 'REPAIR_IF_PANEL' | 'IF_BLOCKED_TURN_LEFT' | 'IF_BLOCKED_TURN_RIGHT' | 'MOVE' | 'TURN_LEFT' | 'TURN_RIGHT';
type Direction = 'UP' | 'RIGHT' | 'DOWN' | 'LEFT';
type SimulationStatus = 'success' | 'wall' | 'panels' | 'failure';

interface DroneFrame {
    row: number;
    col: number;
    direction: Direction;
    repairedPanels: string[];
    activeCommand: CommandId | null;
}

interface SimulationResult {
    frames: DroneFrame[];
    status: SimulationStatus;
}

const GRID = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 3, 0, 2, 0, 0, 1],
    [1, 1, 1, 0, 1, 1, 1],
    [1, 1, 1, 0, 1, 1, 1],
    [1, 0, 0, 2, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
];

const START = { row: 5, col: 1, direction: 'RIGHT' as Direction };
const EXIT = { row: 2, col: 1 };
const PANELS = ['5,3', '2,3'];
const COMMAND_OPTIONS: CommandId[] = ['REPAIR_IF_PANEL', 'IF_BLOCKED_TURN_LEFT', 'IF_BLOCKED_TURN_RIGHT', 'MOVE', 'TURN_LEFT', 'TURN_RIGHT'];
const EMPTY_PROGRAM: Array<CommandId | null> = [null, null, null];

export default function Level8DroneAutopilot({ campaignId, levelId }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const [program, setProgram] = useState<Array<CommandId | null>>(EMPTY_PROGRAM);
    const [iterations, setIterations] = useState(4);
    const [selectedCommand, setSelectedCommand] = useState<CommandId | null>(null);
    const [hintOpen, setHintOpen] = useState(false);
    const [feedbackKey, setFeedbackKey] = useState('level8.awaiting');
    const [runtimeError, setRuntimeError] = useState<string | null>(null);
    const [currentFrame, setCurrentFrame] = useState<DroneFrame>({
        row: START.row,
        col: START.col,
        direction: START.direction,
        repairedPanels: [],
        activeCommand: null,
    });
    const [isRunning, setIsRunning] = useState(false);
    const [isSolved, setIsSolved] = useState(false);

    const repairedPanelCount = currentFrame.repairedPanels.length;
    const commands = useMemo(() => program.filter((command): command is CommandId => Boolean(command)), [program]);

    const handleCommandSelect = (command: CommandId) => {
        if (isSolved || isChecking || isRunning) {
            return;
        }

        audio.playClick();
        setSelectedCommand((prev) => (prev === command ? null : command));
    };

    const handleSlotClick = (slotIndex: number) => {
        if (isSolved || isChecking || isRunning) {
            return;
        }

        if (!selectedCommand) {
            audio.playHover();
            setProgram((prev) => prev.map((command, index) => (index === slotIndex ? null : command)));
            return;
        }

        audio.playClick();
        setRuntimeError(null);
        setProgram((prev) => prev.map((command, index) => (index === slotIndex ? selectedCommand : command)));
        setFeedbackKey('level8.programUpdated');
    };

    const handleReset = () => {
        if (isSolved || isChecking || isRunning) {
            return;
        }

        audio.playHover();
        setProgram(EMPTY_PROGRAM);
        setIterations(4);
        setSelectedCommand(null);
        setRuntimeError(null);
        setCurrentFrame({ row: START.row, col: START.col, direction: START.direction, repairedPanels: [], activeCommand: null });
        setFeedbackKey('level8.awaiting');
    };

    const handleRun = async () => {
        if (isSolved || isChecking || isRunning) {
            return;
        }

        if (commands.length !== program.length) {
            audio.playDeny();
            setFeedbackKey('level8.incomplete');
            return;
        }

        audio.playClick();
        setRuntimeError(null);
        setIsRunning(true);
        setFeedbackKey('level8.executing');

        const simulation = simulateProgram(commands, iterations);

        for (const frame of simulation.frames) {
            setCurrentFrame(frame);
            await wait(250);
        }

        setIsRunning(false);

        if (simulation.status !== 'success') {
            audio.playDeny();
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            setFeedbackKey(`level8.${simulation.status}`);
            return;
        }

        const result = await validate({ commands, iterations });
        if (!result.success) {
            audio.playDeny();
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            setFeedbackKey('level8.failure');
            setRuntimeError(result.message || null);
            return;
        }

        audio.playSuccess();
        setIsSolved(true);
        setFeedbackKey('level8.success');
        window.setTimeout(() => {
            result.unlocks.forEach((item) => gameEvents.publish('ITEM_FOUND', item));
            audio.playItemFound();
            setFeedbackKey('level8.unlock');
        }, 1200);
        window.setTimeout(() => {
            gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'COMPLETE' });
        }, 2900);
    };

    return (
        <div className="relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-slate-950 p-3 text-slate-100 xl:p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12)_0%,rgba(2,6,23,1)_58%)]" />

            <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-3 xl:gap-4">
                <div className="shrink-0 overflow-hidden rounded-2xl border border-amber-400/25 bg-black/40 p-4 shadow-2xl backdrop-blur-md">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 text-amber-300">
                                <Bot size={18} />
                                <div className="text-xs font-mono uppercase tracking-[0.24em]">{t('level8.subtitle')}</div>
                            </div>
                            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white xl:text-3xl">{t('level8.title')}</h2>
                            <p className="mt-3 max-w-4xl border-l-2 border-amber-400 pl-3 text-sm leading-relaxed text-amber-100">{t(feedbackKey)}</p>
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

                <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.06fr)_minmax(21rem,0.94fr)]">
                    <section className="flex min-h-0 min-w-0 flex-col rounded-[1.75rem] border border-slate-700 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.1),rgba(2,6,23,1)_62%)] p-4 shadow-xl xl:p-5">
                        <div className="grid gap-3 sm:grid-cols-4">
                            <DroneStatCard label={t('level8.metrics.loop')} value={`${iterations}x`} accent="amber" />
                            <DroneStatCard label={t('level8.metrics.repaired')} value={`${repairedPanelCount}/${PANELS.length}`} accent={repairedPanelCount === PANELS.length ? 'emerald' : 'amber'} />
                            <DroneStatCard label={t('level8.metrics.direction')} value={t(`level8.directions.${currentFrame.direction.toLowerCase()}`)} accent="slate" />
                            <DroneStatCard label={t('level8.metrics.position')} value={`${currentFrame.row},${currentFrame.col}`} accent="slate" />
                        </div>

                        <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(17rem,0.86fr)_minmax(0,1.14fr)]">
                            <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950/78 p-4">
                                <div>
                                    <div className="text-xs font-mono uppercase tracking-[0.2em] text-amber-300">{t('level8.commandDeckTitle')}</div>
                                    <div className="mt-3 grid gap-2">
                                        {COMMAND_OPTIONS.map((command) => {
                                            const selected = selectedCommand === command;
                                            return (
                                                <button
                                                    key={command}
                                                    onClick={() => handleCommandSelect(command)}
                                                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${selected
                                                        ? 'border-amber-300/70 bg-amber-500/15 text-amber-100'
                                                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-amber-400/40'}`}
                                                >
                                                    {t(`level8.commands.${command}`)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                                    <div className="flex items-center gap-2 text-amber-300">
                                        <Repeat size={15} />
                                        <div className="text-xs font-mono uppercase tracking-[0.2em]">{t('level8.iterationsTitle')}</div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between gap-3">
                                        <button
                                            onClick={() => setIterations((prev) => Math.max(1, prev - 1))}
                                            disabled={isSolved || isChecking || isRunning}
                                            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-lg text-slate-300 transition-colors hover:border-amber-400/35 disabled:opacity-40"
                                        >
                                            −
                                        </button>
                                        <div className="text-3xl font-semibold tracking-tight text-white">{iterations}</div>
                                        <button
                                            onClick={() => setIterations((prev) => Math.min(9, prev + 1))}
                                            disabled={isSolved || isChecking || isRunning}
                                            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-lg text-slate-300 transition-colors hover:border-amber-400/35 disabled:opacity-40"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex min-h-0 flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950/78 p-4">
                                <div>
                                    <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('level8.programTitle')}</div>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                        {program.map((command, index) => (
                                            <button
                                                key={`slot-${index}`}
                                                onClick={() => handleSlotClick(index)}
                                                className={`min-h-[5.75rem] rounded-2xl border px-3 py-3 text-left transition-colors ${command
                                                    ? 'border-amber-400/50 bg-amber-950/18 text-amber-100'
                                                    : 'border-slate-700 bg-slate-900/80 text-slate-500 hover:border-slate-500'}`}
                                            >
                                                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">{t('level8.slotLabel', { index: index + 1 })}</div>
                                                <div className="mt-2 text-sm leading-tight">{command ? t(`level8.commands.${command}`) : t('level8.emptySlot')}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-1 rounded-3xl border border-slate-800 bg-black/30 p-4">
                                    <div className="flex items-center gap-2 text-amber-300">
                                        <Gauge size={15} />
                                        <div className="text-xs font-mono uppercase tracking-[0.2em]">{t('level8.gridTitle')}</div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-7 gap-2">
                                        {GRID.flatMap((row, rowIndex) => row.map((cell, colIndex) => (
                                            <div
                                                key={`${rowIndex}-${colIndex}`}
                                                className={`relative flex aspect-square items-center justify-center rounded-xl border text-[10px] font-mono uppercase tracking-[0.18em] ${getCellClass(cell)}`}
                                            >
                                                {cell === 2 && (
                                                    <span className={`text-[11px] ${currentFrame.repairedPanels.includes(`${rowIndex},${colIndex}`) ? 'text-emerald-200' : 'text-amber-200'}`}>
                                                        {currentFrame.repairedPanels.includes(`${rowIndex},${colIndex}`) ? 'FIX' : 'REP'}
                                                    </span>
                                                )}
                                                {cell === 3 && <span className="text-cyan-200">EXIT</span>}
                                                {currentFrame.row === rowIndex && currentFrame.col === colIndex && (
                                                    <div className="absolute inset-1 flex items-center justify-center rounded-lg border border-cyan-300/60 bg-cyan-500/20 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.28)]">
                                                        <span>{getDirectionGlyph(currentFrame.direction)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto rounded-[1.75rem] border border-slate-700 bg-black/35 p-4 shadow-xl custom-scrollbar xl:p-5 xl:pr-3">
                        <div className="rounded-2xl border border-slate-700 bg-slate-950/82 p-4">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-amber-300">{t('level8.objectiveTitle')}</div>
                            <p className="mt-3 text-sm leading-relaxed text-slate-300">{t('level8.objective')}</p>
                        </div>

                        <button
                            onClick={() => setHintOpen((prev) => !prev)}
                            className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/82 px-4 py-3 text-left transition-colors hover:border-amber-400/35"
                        >
                            <HelpCircle size={16} className="text-amber-300" />
                            <span className="flex-1 text-xs font-mono uppercase tracking-[0.2em] text-amber-100">{t('level8.hintTitle')}</span>
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
                                    <div className="rounded-2xl border border-amber-400/20 bg-amber-950/20 px-4 py-3 text-sm leading-relaxed text-amber-100 whitespace-pre-line">
                                        {t('level8.hint')}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="rounded-2xl border border-slate-700 bg-slate-950/82 p-4">
                            <div className="flex items-center gap-2 text-amber-300">
                                <Wrench size={15} />
                                <div className="text-xs font-mono uppercase tracking-[0.2em]">{t('level8.runLogTitle')}</div>
                            </div>
                            <div className="mt-3 grid gap-2 text-sm text-slate-300">
                                <TelemetryRow label={t('level8.metrics.activeCommand')} value={currentFrame.activeCommand ? t(`level8.commands.${currentFrame.activeCommand}`) : t('level8.idle')} />
                                <TelemetryRow label={t('level8.metrics.repaired')} value={`${repairedPanelCount}/${PANELS.length}`} />
                                <TelemetryRow label={t('level8.metrics.position')} value={`${currentFrame.row},${currentFrame.col}`} />
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                            <button
                                onClick={handleReset}
                                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs uppercase tracking-[0.22em] text-slate-200 transition-colors hover:border-slate-500"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <RefreshCcw size={15} />
                                    <span>{t('level8.reset')}</span>
                                </div>
                            </button>
                            <button
                                onClick={() => {
                                    void handleRun();
                                }}
                                disabled={isChecking || isSolved || isRunning}
                                className="rounded-2xl border border-amber-400/45 bg-amber-500/10 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <Play size={15} />
                                    <span>{isRunning ? t('level8.executingShort') : isChecking ? t('level8.validating') : t('level8.run')}</span>
                                </div>
                            </button>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-slate-950/76 px-4 py-3 text-sm text-slate-300">
                            {runtimeError ?? error ?? t(isSolved ? 'level8.success' : 'level8.statusHint')}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

function simulateProgram(commands: CommandId[], iterations: number): SimulationResult {
    let row = START.row;
    let col = START.col;
    let direction = START.direction;
    const repairedPanels = new Set<string>();
    const frames: DroneFrame[] = [{ row, col, direction, repairedPanels: [], activeCommand: null }];
    const turnLeft: Record<Direction, Direction> = { UP: 'LEFT', LEFT: 'DOWN', DOWN: 'RIGHT', RIGHT: 'UP' };
    const turnRight: Record<Direction, Direction> = { UP: 'RIGHT', RIGHT: 'DOWN', DOWN: 'LEFT', LEFT: 'UP' };
    const deltas: Record<Direction, [number, number]> = { UP: [-1, 0], RIGHT: [0, 1], DOWN: [1, 0], LEFT: [0, -1] };

    const isBlocked = (nextRow: number, nextCol: number) => (
        nextRow < 0 || nextRow >= GRID.length || nextCol < 0 || nextCol >= GRID[0].length || GRID[nextRow][nextCol] === 1
    );

    for (let iterationIndex = 0; iterationIndex < iterations; iterationIndex += 1) {
        for (const command of commands) {
            if (command === 'TURN_LEFT') {
                direction = turnLeft[direction];
            } else if (command === 'TURN_RIGHT') {
                direction = turnRight[direction];
            } else if (command === 'IF_BLOCKED_TURN_LEFT') {
                const [deltaRow, deltaCol] = deltas[direction];
                if (isBlocked(row + deltaRow, col + deltaCol)) {
                    direction = turnLeft[direction];
                }
            } else if (command === 'IF_BLOCKED_TURN_RIGHT') {
                const [deltaRow, deltaCol] = deltas[direction];
                if (isBlocked(row + deltaRow, col + deltaCol)) {
                    direction = turnRight[direction];
                }
            } else if (command === 'REPAIR_IF_PANEL') {
                if (GRID[row][col] === 2) {
                    repairedPanels.add(`${row},${col}`);
                }
            } else if (command === 'MOVE') {
                const [deltaRow, deltaCol] = deltas[direction];
                const nextRow = row + deltaRow;
                const nextCol = col + deltaCol;
                if (isBlocked(nextRow, nextCol)) {
                    frames.push({ row, col, direction, repairedPanels: [...repairedPanels], activeCommand: command });
                    return { frames, status: 'wall' };
                }
                row = nextRow;
                col = nextCol;
            }

            frames.push({ row, col, direction, repairedPanels: [...repairedPanels], activeCommand: command });

            if (row === EXIT.row && col === EXIT.col && repairedPanels.size === PANELS.length) {
                return { frames, status: 'success' };
            }
        }
    }

    if (repairedPanels.size !== PANELS.length) {
        return { frames, status: 'panels' };
    }

    return { frames, status: 'failure' };
}

function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getCellClass(cell: number) {
    if (cell === 1) {
        return 'border-slate-900 bg-slate-950/90';
    }
    if (cell === 2) {
        return 'border-amber-400/30 bg-amber-500/10';
    }
    if (cell === 3) {
        return 'border-cyan-400/35 bg-cyan-500/10';
    }
    return 'border-slate-700 bg-slate-900/80';
}

function getDirectionGlyph(direction: Direction) {
    if (direction === 'UP') {
        return '↑';
    }
    if (direction === 'DOWN') {
        return '↓';
    }
    if (direction === 'LEFT') {
        return '←';
    }
    return '→';
}

function DroneStatCard({ label, value, accent }: { label: string; value: string; accent: 'amber' | 'emerald' | 'slate' }) {
    const accentClass = accent === 'amber'
        ? 'border-amber-400/35 bg-amber-500/10 text-amber-100'
        : accent === 'emerald'
            ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
            : 'border-slate-700 bg-slate-900/70 text-slate-200';

    return (
        <div className={`rounded-2xl border px-4 py-3 ${accentClass}`}>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">{label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
        </div>
    );
}

function TelemetryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2">
            <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">{label}</span>
            <span className="text-sm text-slate-200">{value}</span>
        </div>
    );
}