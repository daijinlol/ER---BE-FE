import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Play,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  ArrowUp,
  CornerDownLeft,
  CornerDownRight,
  X,
  Trash2,
  Flag,
  Lock,
  Unlock,
  Cpu,
  Gauge,
} from 'lucide-react';
import { audio } from '../../../../core/AudioEngine';
import { gameEvents } from '../../../../core/EventBus';
import { usePuzzleValidation } from '../../../../hooks/usePuzzleValidation';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../../core/gameConstants';
import type { PuzzleComponentProps } from '../../types';

const COLS = 10;
const ROWS = 5;

const GRID: number[][] = [
  [2, 0, 0, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 0, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 0, 0, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 0, 0, 3, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const START: [number, number] = [0, 0];
const EXIT: [number, number] = [3, 8];

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Command = 'MOVE' | 'TURN_LEFT' | 'TURN_RIGHT';

interface RobotState {
  row: number;
  col: number;
  dir: Direction;
}

const DIRECTION_DELTAS: Record<Direction, [number, number]> = {
  UP: [-1, 0],
  DOWN: [1, 0],
  LEFT: [0, -1],
  RIGHT: [0, 1],
};

const TURN_LEFT_MAP: Record<Direction, Direction> = {
  UP: 'LEFT', LEFT: 'DOWN', DOWN: 'RIGHT', RIGHT: 'UP',
};

const TURN_RIGHT_MAP: Record<Direction, Direction> = {
  UP: 'RIGHT', RIGHT: 'DOWN', DOWN: 'LEFT', LEFT: 'UP',
};

const DIR_ROTATION: Record<Direction, number> = {
  UP: 0, RIGHT: 90, DOWN: 180, LEFT: 270,
};

type SimResult = {
  path: RobotState[];
  success: boolean;
  reason: 'WALL' | 'MISSED_EXIT' | 'SUCCESS';
};

function simulate(commands: Command[], iterations: number): SimResult {
  const path: RobotState[] = [{ row: START[0], col: START[1], dir: 'RIGHT' }];
  let robot: RobotState = { ...path[0] };

  for (let iteration = 0; iteration < iterations; iteration++) {
    for (const cmd of commands) {
      if (cmd === 'TURN_LEFT') {
        robot = { ...robot, dir: TURN_LEFT_MAP[robot.dir] };
        path.push({ ...robot });
      } else if (cmd === 'TURN_RIGHT') {
        robot = { ...robot, dir: TURN_RIGHT_MAP[robot.dir] };
        path.push({ ...robot });
      } else {
        const [dr, dc] = DIRECTION_DELTAS[robot.dir];
        const nextRow = robot.row + dr;
        const nextCol = robot.col + dc;

        if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS || GRID[nextRow][nextCol] === 1) {
          path.push({ ...robot });
          return { path, success: false, reason: 'WALL' };
        }

        robot = { ...robot, row: nextRow, col: nextCol };
        path.push({ ...robot });

        if (nextRow === EXIT[0] && nextCol === EXIT[1]) {
          return { path, success: true, reason: 'SUCCESS' };
        }
      }
    }
  }

  return { path, success: false, reason: 'MISSED_EXIT' };
}

const MAX_COMMANDS = 6;

const COMMAND_ICONS: Record<Command, typeof ArrowUp> = {
  MOVE: ArrowUp,
  TURN_LEFT: CornerDownLeft,
  TURN_RIGHT: CornerDownRight,
};

const COMMAND_COLORS: Record<Command, string> = {
  MOVE: 'border-emerald-400/40 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/18',
  TURN_LEFT: 'border-amber-400/40 bg-amber-500/12 text-amber-100 hover:bg-amber-500/18',
  TURN_RIGHT: 'border-sky-400/40 bg-sky-500/12 text-sky-100 hover:bg-sky-500/18',
};

export default function Level2_Loops({ campaignId, levelId }: PuzzleComponentProps) {
  const { t } = useTranslation();
  const { validate } = usePuzzleValidation(campaignId, levelId);

  const [commands, setCommands] = useState<Command[]>([]);
  const [iterations, setIterations] = useState<number | ''>(1);
  const [hintOpen, setHintOpen] = useState(false);
  const [isSolved, setIsSolved] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [robotPos, setRobotPos] = useState<RobotState>({ row: START[0], col: START[1], dir: 'RIGHT' });
  const [visitedCells, setVisitedCells] = useState<Set<string>>(new Set([`${START[0]},${START[1]}`]));
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; key: string } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const cancelRef = useRef(false);

  const programSummary = useMemo(
    () => commands.length === 0 ? t('level2.emptyBody') : commands.map((command) => t(`level2.cmd_${command}`)).join(' • '),
    [commands, t],
  );

  const addCommand = (cmd: Command) => {
    if (commands.length < MAX_COMMANDS && !isRunning && !isSolved) {
      audio.playClick();
      setCommands((prev) => [...prev, cmd]);
    }
  };

  const removeCommand = (idx: number) => {
    if (!isRunning && !isSolved) {
      audio.playClick();
      setCommands((prev) => prev.filter((_, index) => index !== idx));
    }
  };

  const resetRobot = useCallback(() => {
    cancelRef.current = true;
    setRobotPos({ row: START[0], col: START[1], dir: 'RIGHT' });
    setVisitedCells(new Set([`${START[0]},${START[1]}`]));
    setCurrentStep(0);
    setTotalSteps(0);
    setCurrentIteration(0);
    setFeedback(null);
    setIsRunning(false);
  }, []);

  const clearAll = () => {
    if (isRunning || isSolved) {
      return;
    }

    audio.playHover();
    setCommands([]);
    setIterations(1);
    resetRobot();
  };

  const handleRun = useCallback(async () => {
    if (commands.length === 0 || iterations === '' || iterations < 1 || isRunning || isSolved) {
      return;
    }

    audio.playClick();
    setFeedback(null);
    resetRobot();

    await new Promise((resolve) => setTimeout(resolve, 50));

    const result = simulate(commands, iterations);
    const path = result.path;

    cancelRef.current = false;
    setIsRunning(true);
    setTotalSteps(path.length - 1);

    for (let index = 1; index < path.length; index++) {
      if (cancelRef.current) {
        return;
      }

      const state = path[index];
      setRobotPos(state);
      setCurrentStep(index);
      setCurrentIteration(Math.floor((index - 1) / commands.length) + 1);
      setVisitedCells((prev) => {
        const next = new Set(prev);
        next.add(`${state.row},${state.col}`);
        return next;
      });

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (cancelRef.current) {
      return;
    }

    if (result.success) {
      audio.playSuccess();
      setFeedback({ type: 'success', key: 'level2.success' });
      setIsSolved(true);

      const check = await validate({ commands, iterations });
      if (check.success) {
        window.setTimeout(() => {
          gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
        }, 2300);
      }
    } else {
      audio.playDeny();
      setMistakes((prev) => prev + 1);
      gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
      setFeedback({ type: 'error', key: result.reason === 'WALL' ? 'level2.hitWall' : 'level2.missedExit' });
    }

    setIsRunning(false);
  }, [commands, isRunning, isSolved, iterations, resetRobot, validate]);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-y-auto bg-slate-950 p-3 text-slate-100 xl:overflow-hidden xl:p-3">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),rgba(2,6,23,1)_58%)]" />
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-3">
        <div className="rounded-2xl border border-emerald-400/20 bg-black/40 p-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 text-emerald-300">
                <Cpu size={18} />
                <div className="text-xs font-mono uppercase tracking-[0.24em]">{t('level2.subtitle')}</div>
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white xl:text-[1.65rem]">{t('level2.title')}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300 xl:text-[13px]">{t('level2.story')}</p>
            </div>
            <button
              onClick={() => {
                audio.playClick();
                gameEvents.publish('PUZZLE_CLOSED');
              }}
              className="rounded-xl border border-slate-700 bg-slate-900/80 p-2 text-slate-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
              title={t('common.closeInterface')}
            >
              <X size={20} />
            </button>
          </div>
          <p className="mt-3 border-l-2 border-emerald-400 pl-3 text-sm leading-relaxed text-emerald-100 xl:text-[13px]">
            {t(feedback ? (feedback.type === 'success' ? 'level2.doorUnlocked' : feedback.key) : 'level2.awaitingProgram')}
          </p>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1.33fr_0.67fr]">
          <div className="rounded-[1.75rem] border border-slate-700 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),rgba(2,6,23,1)_62%)] p-4 shadow-xl">
            <div className="grid gap-2 sm:grid-cols-3">
              <StatCard label={t('level2.iteration')} value={String(currentIteration)} accent="emerald" />
              <StatCard label={t('level2.step')} value={`${currentStep}/${totalSteps}`} accent="sky" />
              <StatCard label={t('level2.mistakes')} value={String(mistakes)} accent="amber" />
            </div>

            <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-300">{t('level2.routeGridTitle')}</div>
                  <div className="mt-1.5 text-sm text-slate-300 xl:text-[13px]">{t('level2.objective')}</div>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2.5 text-right">
                  <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-emerald-200">{t('level2.programStatusTitle')}</div>
                  <div className="mt-2 text-lg font-semibold text-white">{commands.length}/{MAX_COMMANDS}</div>
                </div>
              </div>

              <div
                className="mt-4 grid overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-950/80 shadow-inner"
                style={{
                  gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
                  width: '100%',
                  aspectRatio: `${COLS}/${ROWS}`,
                }}
              >
                {GRID.map((row, rowIndex) => row.map((cell, colIndex) => {
                  const isStart = rowIndex === START[0] && colIndex === START[1];
                  const isExit = rowIndex === EXIT[0] && colIndex === EXIT[1];
                  const isWall = cell === 1;
                  const isVisited = visitedCells.has(`${rowIndex},${colIndex}`);
                  const isRobot = robotPos.row === rowIndex && robotPos.col === colIndex;

                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`relative flex items-center justify-center border border-slate-900/80 transition-colors ${isWall
                        ? 'bg-slate-800'
                        : isExit
                          ? isSolved ? 'bg-emerald-900/50' : 'bg-amber-900/30'
                          : isStart
                            ? 'bg-sky-900/30'
                            : isVisited
                              ? 'bg-emerald-500/10'
                              : 'bg-slate-900/85'}`}
                    >
                      {isWall && <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.22)_5px,rgba(0,0,0,0.22)_10px)]" />}
                      {isExit && !isRobot && <Flag size={18} className={`${isSolved ? 'text-emerald-300' : 'text-amber-300'} drop-shadow-md`} />}
                      {isStart && !isRobot && !isRunning && <div className="h-3 w-3 rounded-full border border-sky-300/60 bg-sky-400/30" />}
                      {isVisited && !isRobot && !isExit && !isStart && <div className="h-1.5 w-1.5 rounded-full bg-emerald-300/60" />}
                      {isRobot && (
                        <motion.div
                          layoutId="robot"
                          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                          className="absolute inset-0 z-10 flex items-center justify-center"
                        >
                          <motion.div
                            animate={{ rotate: DIR_ROTATION[robotPos.dir] }}
                            transition={{ duration: 0.15 }}
                            className={`flex h-8 w-8 items-center justify-center rounded-full shadow-lg ${isSolved ? 'bg-emerald-500 shadow-emerald-500/40' : 'bg-sky-500 shadow-sky-500/40'}`}
                          >
                            <ArrowUp size={16} className="text-white" />
                          </motion.div>
                        </motion.div>
                      )}
                    </div>
                  );
                }))}
              </div>
            </div>

            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`mt-3 rounded-2xl border px-4 py-3 text-sm xl:text-[13px] ${feedback.type === 'error'
                    ? 'border-red-500/40 bg-red-950/45 text-red-200'
                    : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'}`}
                >
                  {t(feedback.key)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex min-h-0 flex-col gap-3 xl:overflow-y-auto xl:pr-1 custom-scrollbar">
            <div className="rounded-2xl border border-slate-700 bg-black/35 p-3 shadow-xl">
              <button
                onClick={() => setHintOpen((prev) => !prev)}
                className="flex w-full items-center gap-2 text-left text-indigo-200 transition-colors hover:text-indigo-100"
              >
                <HelpCircle size={16} />
                <span className="flex-1 text-xs font-mono uppercase tracking-[0.2em]">{t('level2.hintTitle')}</span>
                {hintOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <AnimatePresence>
                {hintOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 rounded-2xl border border-indigo-400/20 bg-indigo-950/30 px-4 py-3 text-sm leading-relaxed text-indigo-100 xl:text-[13px]">
                      {t('level2.hint')}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-black/35 p-3 shadow-xl">
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('level2.commandDeckTitle')}</div>
              <div className="mt-3 grid gap-2">
                {(['MOVE', 'TURN_LEFT', 'TURN_RIGHT'] as Command[]).map((cmd) => {
                  const Icon = COMMAND_ICONS[cmd];
                  return (
                    <button
                      key={cmd}
                      disabled={commands.length >= MAX_COMMANDS || isRunning || isSolved}
                      onClick={() => addCommand(cmd)}
                      className={`rounded-2xl border px-4 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${COMMAND_COLORS[cmd]}`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={15} />
                        <span className="font-mono text-xs font-bold uppercase tracking-[0.2em]">{t(`level2.cmd_${cmd}`)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-black/35 p-3 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('level2.loopEditor')}</div>
                <button
                  onClick={clearAll}
                  disabled={isRunning || isSolved}
                  className="rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-slate-500 transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-30"
                  title={t('common.clear')}
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              <div className="mt-3 rounded-2xl border border-indigo-400/20 bg-indigo-950/20 px-4 py-3">
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-indigo-200">{t('level2.iterationControlTitle')}</div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-sm text-indigo-100">{t('level2.repeat')}</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={iterations}
                    onChange={(event) => setIterations(event.target.value === '' ? '' : Math.max(1, Math.min(20, Number(event.target.value))))}
                    disabled={isRunning || isSolved}
                    className="w-16 rounded-xl border border-indigo-400/30 bg-slate-950 px-2 py-2 text-center font-mono text-sm text-white outline-none transition-colors focus:border-cyan-400 disabled:opacity-50"
                    placeholder="×"
                  />
                  <span className="font-mono text-sm text-indigo-200">×</span>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/75 p-3">
                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">{t('level2.currentProgramTitle')}</div>
                <div className="mt-3 space-y-2">
                  {commands.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-3 text-sm italic text-slate-500">{t('level2.emptyBody')}</div>
                  ) : (
                    commands.map((cmd, idx) => {
                      const Icon = COMMAND_ICONS[cmd];
                      const isActiveStep = isRunning && currentStep > 0 && ((currentStep - 1) % commands.length === idx);
                      return (
                        <motion.div
                          key={`${cmd}-${idx}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${isActiveStep
                            ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100'
                            : 'border-slate-800 bg-slate-900/80 text-slate-300'}`}
                        >
                          <span className="w-6 font-mono text-xs text-slate-500">{idx + 1}</span>
                          <Icon size={14} />
                          <span className="flex-1 font-mono text-xs font-bold uppercase tracking-[0.18em]">{t(`level2.cmd_${cmd}`)}</span>
                          {!isRunning && !isSolved && (
                            <button onClick={() => removeCommand(idx)} className="text-slate-500 transition-colors hover:text-red-300">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </motion.div>
                      );
                    })
                  )}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                  <MetricRow label={t('level2.iteration')} value={String(currentIteration)} accent="text-emerald-300" />
                  <MetricRow label={t('level2.step')} value={`${currentStep}/${totalSteps}`} accent="text-sky-300" />
                  <MetricRow label={t('level2.mistakes')} value={String(mistakes)} accent="text-red-300" />
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {!isRunning && !isSolved && (
                <button
                  onClick={handleRun}
                  disabled={commands.length === 0 || iterations === '' || iterations < 1}
                  className="rounded-2xl border border-emerald-400/45 bg-emerald-500/12 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-emerald-100 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Play size={15} fill="currentColor" />
                    <span>{t('level2.run')}</span>
                  </div>
                </button>
              )}
              {isRunning && (
                <button
                  onClick={resetRobot}
                  className="rounded-2xl border border-red-400/45 bg-red-500/12 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-red-100 transition-colors hover:bg-red-500/20"
                >
                  <div className="flex items-center justify-center gap-2">
                    <RotateCcw size={15} />
                    <span>{t('level2.stop')}</span>
                  </div>
                </button>
              )}
              {!isRunning && feedback?.type === 'error' && (
                <button
                  onClick={resetRobot}
                  className="rounded-2xl border border-slate-600 bg-slate-800/80 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-slate-100 transition-colors hover:bg-slate-700"
                >
                  <div className="flex items-center justify-center gap-2">
                    <RotateCcw size={15} />
                    <span>{t('level2.reset')}</span>
                  </div>
                </button>
              )}

              <div className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-center shadow-xl">
                <div className="flex items-center justify-center gap-2">
                  {isSolved ? <Unlock size={18} className="text-emerald-300" /> : <Lock size={18} className="text-red-300" />}
                  <span className={`font-mono text-xs uppercase tracking-[0.22em] ${isSolved ? 'text-emerald-300' : 'text-slate-500'}`}>
                    {isSolved ? t('level2.doorOpen') : t('level2.doorLocked')}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-300 shadow-xl">
                <div className="flex items-center gap-2 text-slate-300">
                  <Gauge size={16} />
                  <span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('level2.executionStatusTitle')}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{programSummary}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'sky' | 'amber' }) {
  const accentClasses = {
    emerald: 'text-emerald-300 border-emerald-400/20 bg-emerald-500/8',
    sky: 'text-sky-300 border-sky-400/20 bg-sky-500/8',
    amber: 'text-amber-300 border-amber-400/20 bg-amber-500/8',
  };

  return (
    <div className={`rounded-2xl border px-4 py-2 ${accentClasses[accent]}`}>
      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1.5 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function MetricRow({ label, value, accent, compact = false }: { label: string; value: string; accent: string; compact?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
      <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className={`${compact ? 'max-w-[14rem] text-right text-xs' : 'text-sm'} ${accent}`}>{value}</span>
    </div>
  );
}
