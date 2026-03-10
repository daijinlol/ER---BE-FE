import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Play, RotateCcw, ChevronUp, ChevronDown, HelpCircle,
  ArrowUp, CornerDownLeft, CornerDownRight, X, Trash2,
  Flag, Lock, Unlock
} from 'lucide-react';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';
import { usePuzzleValidation } from '../../../hooks/usePuzzleValidation';

// ── Grid Definition ──────────────────────────────────────────────
// 0 = path, 1 = wall, 2 = start, 3 = exit
const COLS = 10;
const ROWS = 5;

const GRID: number[][] = [
  [2, 0, 0, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 0, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 0, 0, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 0, 0, 3, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const START: [number, number] = [0, 0]; // row, col
const EXIT: [number, number] = [3, 8];

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Command = 'MOVE' | 'TURN_LEFT' | 'TURN_RIGHT';

interface RobotState {
  row: number;
  col: number;
  dir: Direction;
}

// ── Direction helpers ────────────────────────────────────────────
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

// ── Simulation ───────────────────────────────────────────────────
type SimResult = {
  path: RobotState[];
  success: boolean;
  reason: 'WALL' | 'MISSED_EXIT' | 'SUCCESS';
};

function simulate(commands: Command[], iterations: number): SimResult {
  const path: RobotState[] = [{ row: START[0], col: START[1], dir: 'RIGHT' as Direction }];
  let robot: RobotState = { ...path[0] };

  for (let i = 0; i < iterations; i++) {
    for (const cmd of commands) {
      if (cmd === 'TURN_LEFT') {
        robot = { ...robot, dir: TURN_LEFT_MAP[robot.dir] };
        path.push({ ...robot });
      } else if (cmd === 'TURN_RIGHT') {
        robot = { ...robot, dir: TURN_RIGHT_MAP[robot.dir] };
        path.push({ ...robot });
      } else {
        // MOVE
        const [dr, dc] = DIRECTION_DELTAS[robot.dir];
        const nr = robot.row + dr;
        const nc = robot.col + dc;
        // Check bounds + walls
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || GRID[nr][nc] === 1) {
          path.push({ ...robot }); // stay in place for visual
          return { path, success: false, reason: 'WALL' };
        }
        robot = { ...robot, row: nr, col: nc };
        path.push({ ...robot });
        // Check exit
        if (nr === EXIT[0] && nc === EXIT[1]) {
          return { path, success: true, reason: 'SUCCESS' };
        }
      }
    }
  }

  return { path, success: false, reason: 'MISSED_EXIT' };
}

// ── Component ────────────────────────────────────────────────────
const MAX_COMMANDS = 6;

const COMMAND_ICONS: Record<Command, typeof ArrowUp> = {
  MOVE: ArrowUp,
  TURN_LEFT: CornerDownLeft,
  TURN_RIGHT: CornerDownRight,
};

const COMMAND_COLORS: Record<Command, string> = {
  MOVE: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500',
  TURN_LEFT: 'bg-amber-600 hover:bg-amber-500 border-amber-500',
  TURN_RIGHT: 'bg-sky-600 hover:bg-sky-500 border-sky-500',
};

export default function Level2_Loops() {
  const { t } = useTranslation();
  const { validate } = usePuzzleValidation('elem_6', '2');

  const [commands, setCommands] = useState<Command[]>([]);
  const [iterations, setIterations] = useState<number | ''>(1);
  const [hintOpen, setHintOpen] = useState(false);
  const [isSolved, setIsSolved] = useState(false);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [robotPos, setRobotPos] = useState<RobotState>({ row: START[0], col: START[1], dir: 'RIGHT' });
  const [visitedCells, setVisitedCells] = useState<Set<string>>(new Set([`${START[0]},${START[1]}`]));
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; key: string } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const cancelRef = useRef(false);

  // ── Command builders ──
  const addCommand = (cmd: Command) => {
    if (commands.length < MAX_COMMANDS && !isRunning && !isSolved) {
      audio.playClick();
      setCommands(prev => [...prev, cmd]);
    }
  };

  const removeCommand = (idx: number) => {
    if (!isRunning && !isSolved) {
      audio.playClick();
      setCommands(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const clearAll = () => {
    if (isRunning || isSolved) return;
    audio.playHover();
    setCommands([]);
    setIterations(1);
    resetRobot();
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

  // ── Run simulation visually ──
  const handleRun = useCallback(async () => {
    if (commands.length === 0 || iterations === '' || iterations < 1 || isRunning || isSolved) return;

    audio.playClick();
    setFeedback(null);
    resetRobot();

    // Small delay to let state settle
    await new Promise(r => setTimeout(r, 50));

    const result = simulate(commands, iterations);
    const path = result.path;

    cancelRef.current = false;
    setIsRunning(true);
    setTotalSteps(path.length - 1);

    // Animate step by step
    for (let i = 1; i < path.length; i++) {
      if (cancelRef.current) return;

      const state = path[i];
      setRobotPos(state);
      setCurrentStep(i);
      setCurrentIteration(Math.floor((i - 1) / commands.length) + 1);
      setVisitedCells(prev => {
        const next = new Set(prev);
        next.add(`${state.row},${state.col}`);
        return next;
      });

      await new Promise(r => setTimeout(r, 250));
    }

    if (cancelRef.current) return;

    // Evaluate result
    if (result.success) {
      audio.playSuccess();
      setFeedback({ type: 'success', key: 'level2.success' });
      setIsSolved(true);

      const check = await validate({
        commands,
        iterations,
      });

      if (check.success) {
        setTimeout(() => {
          (check.unlocks || []).forEach((item: string) => {
            gameEvents.publish('ITEM_FOUND', item);
          });
          audio.playItemFound();
        }, 1500);

        setTimeout(() => {
          gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
        }, 3500);
      }
    } else {
      audio.playDeny();
      setMistakes(prev => prev + 1);
      gameEvents.publish('TIME_PENALTY', { seconds: 30 });

      const feedbackKey = result.reason === 'WALL' ? 'level2.hitWall' : 'level2.missedExit';
      setFeedback({ type: 'error', key: feedbackKey });
    }

    setIsRunning(false);
  }, [commands, iterations, isRunning, isSolved, resetRobot, validate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { cancelRef.current = true; };
  }, []);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col items-center p-4 bg-slate-900 overflow-y-auto relative">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0%,rgba(15,23,42,1)_100%)] pointer-events-none" />

      <div className="w-full z-10 flex flex-col gap-3 cursor-default flex-1">
        {/* ─── Terminal Header ─── */}
        <div className="bg-black/50 border border-slate-700/50 rounded-xl p-4 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-green-500 to-blue-500" />
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-4">
              <Play className="text-slate-400" size={20} />
              <div>
                <h2 className="text-sm font-mono text-slate-200 uppercase tracking-widest">
                  {t('level2.title')}
                </h2>
                <p className="text-xs font-mono text-slate-500 tracking-wider">
                  {t('level2.subtitle')}
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
          <p className="font-mono text-xs text-brand-400 border-l-2 border-brand-500 pl-3">
            {t(feedback ? (feedback.type === 'success' ? 'level2.doorUnlocked' : feedback.key) : 'level2.awaitingProgram')}
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="inline-block w-2 h-4 bg-brand-400 ml-1 translate-y-1"
            />
          </p>
        </div>

        {/* ─── Hint Panel ─── */}
        <button
          onClick={() => setHintOpen(prev => !prev)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-950/40 border border-indigo-500/30 rounded-lg text-indigo-300 text-xs font-mono tracking-wider hover:bg-indigo-950/60 transition-colors w-full text-left"
        >
          <HelpCircle size={14} />
          <span className="flex-1">{t('level2.hintTitle')}</span>
          {hintOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <AnimatePresence>
          {hintOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-lg px-4 py-2 text-indigo-200 text-xs font-mono leading-normal">
                {t('level2.hint')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Main Area: Grid + Controls ─── */}
        <div className="bg-surface-dark border border-slate-700 rounded-xl p-5 shadow-xl flex flex-col lg:flex-row gap-5 items-stretch flex-1">
          {/* Left: Grid */}
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* Stats bar */}
            <div className="flex items-center gap-6 mb-3 text-xs font-mono text-slate-400 tracking-wider w-full">
              <span>{t('level2.iteration')}: <span className="text-brand-400 font-bold">{currentIteration}</span></span>
              <span>{t('level2.step')}: <span className="text-brand-400 font-bold">{currentStep}/{totalSteps}</span></span>
              <span>{t('level2.mistakes')}: <span className="text-red-400 font-bold">{mistakes}</span></span>
            </div>

            {/* Grid */}
            <div
              className="grid border-2 border-slate-600 rounded-lg overflow-hidden shadow-inner"
              style={{
                gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                gridTemplateRows: `repeat(${ROWS}, 1fr)`,
                width: '100%',
                maxWidth: '100%', // Fills left column completely
                maxHeight: '60vh', // Prevent vertical overflow
                aspectRatio: `${COLS}/${ROWS}`,
              }}
            >
              {GRID.map((row, r) =>
                row.map((cell, c) => {
                  const isStart = r === START[0] && c === START[1];
                  const isExit = r === EXIT[0] && c === EXIT[1];
                  const isWall = cell === 1;
                  const isVisited = visitedCells.has(`${r},${c}`);
                  const isRobot = robotPos.row === r && robotPos.col === c;

                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`
                        relative flex items-center justify-center border border-slate-800/50 transition-colors duration-200
                        ${isWall
                          ? 'bg-slate-800'
                          : isExit
                            ? isSolved ? 'bg-green-900/60' : 'bg-amber-900/30'
                            : isStart
                              ? 'bg-brand-900/30'
                              : isVisited
                                ? 'bg-brand-500/10'
                                : 'bg-slate-900/80'
                        }
                      `}
                    >
                      {/* Wall texture */}
                      {isWall && (
                        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.2)_4px,rgba(0,0,0,0.2)_8px)]" />
                      )}

                      {/* Exit marker */}
                      {isExit && !isRobot && (
                        <Flag size={20} className={`${isSolved ? 'text-green-400' : 'text-amber-400'} drop-shadow-md`} />
                      )}

                      {/* Start marker */}
                      {isStart && !isRobot && !isRunning && (
                        <div className="w-3 h-3 rounded-full bg-brand-500/40 border border-brand-400/50" />
                      )}

                      {/* Robot */}
                      {isRobot && (
                        <motion.div
                          layoutId="robot"
                          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                          className="absolute inset-0 flex items-center justify-center z-10"
                        >
                          <motion.div
                            animate={{ rotate: DIR_ROTATION[robotPos.dir] }}
                            transition={{ duration: 0.15 }}
                            className={`w-7 h-7 rounded-full flex items-center justify-center shadow-lg ${
                              isSolved ? 'bg-green-500 shadow-green-500/50' : 'bg-brand-500 shadow-brand-500/50'
                            }`}
                          >
                            <ArrowUp size={16} className="text-white" />
                          </motion.div>
                        </motion.div>
                      )}

                      {/* Visited trail dot */}
                      {isVisited && !isRobot && !isExit && !isStart && (
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-400/40" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Feedback message */}
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className={`mt-3 p-2 rounded-lg text-xs font-mono text-center w-full max-w-[560px] ${
                    feedback.type === 'error'
                      ? 'bg-red-950/60 border border-red-500/50 text-red-300'
                      : 'bg-green-950/60 border border-green-500/50 text-green-300'
                  }`}
                >
                  {feedback.type === 'error' ? '⚠ ' : '✓ '}{t(feedback.key)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Controls Panel */}
          <div className="w-full lg:w-72 flex flex-col gap-4">
            {/* Command Palette */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
              <h3 className="text-[10px] font-bold text-slate-400 mb-2 tracking-widest uppercase">{t('level2.commands')}</h3>
              <div className="flex flex-col gap-2">
                {(['MOVE', 'TURN_LEFT', 'TURN_RIGHT'] as Command[]).map(cmd => {
                  const Icon = COMMAND_ICONS[cmd];
                  return (
                    <button
                      key={cmd}
                      disabled={commands.length >= MAX_COMMANDS || isRunning || isSolved}
                      onClick={() => addCommand(cmd)}
                      className={`flex items-center gap-2 px-3 py-2 rounded border text-white text-xs font-mono font-bold tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${COMMAND_COLORS[cmd]}`}
                    >
                      <Icon size={14} />
                      {t(`level2.cmd_${cmd}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Loop Editor */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{t('level2.loopEditor')}</h3>
                <button
                  onClick={clearAll}
                  disabled={isRunning || isSolved}
                  className="text-slate-500 hover:text-red-400 transition-colors disabled:opacity-30"
                  title="Clear"
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              {/* Iteration count */}
              <div className="flex items-center gap-2 mb-3 bg-indigo-900/30 border border-indigo-500/30 rounded-lg px-3 py-2">
                <span className="text-indigo-300 text-xs font-mono font-bold">{t('level2.repeat')}</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={iterations}
                  onChange={(e) => setIterations(e.target.value === '' ? '' : Math.max(1, Math.min(20, Number(e.target.value))))}
                  disabled={isRunning || isSolved}
                  className="w-12 bg-slate-900 border-b-2 border-indigo-400 focus:outline-none focus:border-brand-400 text-center text-sm text-white py-0.5 font-mono disabled:opacity-50"
                  placeholder="×"
                />
                <span className="text-indigo-300 text-xs font-mono font-bold">×</span>
              </div>

              {/* Loop body */}
              <div className="flex-1 bg-black/40 border border-slate-700/50 rounded-lg p-2 flex flex-col gap-1 min-h-[100px]">
                {commands.length === 0 ? (
                  <span className="text-slate-600 text-xs font-mono italic p-2">{t('level2.emptyBody')}</span>
                ) : (
                  commands.map((cmd, idx) => {
                    const Icon = COMMAND_ICONS[cmd];
                    return (
                      <motion.div
                        key={`${cmd}-${idx}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs font-mono border ${
                          isRunning && currentStep > 0 && ((currentStep - 1) % commands.length === idx)
                            ? 'bg-brand-500/20 border-brand-400 text-brand-200'
                            : 'bg-slate-800/60 border-slate-700/50 text-slate-300'
                        }`}
                      >
                        <span className="text-slate-500 w-4">{idx + 1}.</span>
                        <Icon size={12} />
                        <span className="flex-1 font-bold">{t(`level2.cmd_${cmd}`)}</span>
                        {!isRunning && !isSolved && (
                          <button
                            onClick={() => removeCommand(idx)}
                            className="text-slate-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Run / Reset buttons */}
            <div className="flex gap-2">
              {!isRunning && !isSolved && (
                <button
                  onClick={handleRun}
                  disabled={commands.length === 0 || iterations === '' || iterations < 1}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold tracking-widest rounded transition-all shadow-[0_0_12px_rgba(16,185,129,0.25)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase text-sm"
                >
                  <Play size={16} fill="currentColor" />
                  {t('level2.run')}
                </button>
              )}
              {isRunning && (
                <button
                  onClick={resetRobot}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-mono font-bold tracking-widest rounded transition-all flex items-center justify-center gap-2 uppercase text-sm"
                >
                  <RotateCcw size={16} />
                  {t('level2.stop')}
                </button>
              )}
              {!isRunning && feedback?.type === 'error' && (
                <button
                  onClick={resetRobot}
                  className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-mono font-bold tracking-widest rounded transition-all flex items-center justify-center gap-2 uppercase text-sm"
                >
                  <RotateCcw size={16} />
                  {t('level2.reset')}
                </button>
              )}
            </div>

            {/* Door Status */}
            <div className="flex items-center justify-center gap-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
              {isSolved
                ? <Unlock size={20} className="text-green-400" />
                : <Lock size={20} className="text-red-500/60" />
              }
              <span className={`text-xs font-mono font-bold tracking-widest ${isSolved ? 'text-green-400' : 'text-slate-500'}`}>
                {isSolved ? t('level2.doorOpen') : t('level2.doorLocked')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
