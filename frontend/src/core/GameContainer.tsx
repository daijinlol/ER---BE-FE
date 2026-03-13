import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { gameEvents } from './EventBus';
import { registry } from '../features/puzzles/registry';
import type { CampaignConfig, PuzzleComponentProps, PuzzleRegistry } from '../features/puzzles/types';
import { InventorySystem } from './InventorySystem';
import { CampaignTimer } from './CampaignTimer';
import { Notepad } from './Notepad';
import { CampaignDebrief } from './CampaignDebrief';
import { Bug, FileText, ShieldAlert, Box } from 'lucide-react';
import { audio } from './AudioEngine';
import { GameSessionProvider, useGameSession, type CampaignSessionSnapshot } from './GameSession';
import { GameErrorBoundary } from './GameErrorBoundary';
import { DEFAULT_CAMPAIGN_TIME_MINUTES, PUZZLE_BACKWARD_TRANSITION_MS, PUZZLE_FORWARD_TRANSITION_MS } from './gameConstants';
import { getCampaignTheme, withAlpha } from './campaignTheme';

interface GameContainerProps {
  campaignId: string;
  onExit: () => void;
  initialSession?: CampaignSessionSnapshot | null;
}

interface GameContainerShellProps {
  campaignId: string;
  onExit: () => void;
}
const puzzleModules = import.meta.glob('../features/puzzles/**/index.tsx');

function getDebugProgressPreset(campaign: CampaignConfig | undefined, targetIndex: number, campaignSessionKey: string) {
  const preset = campaign?.debugProgressPresets?.[String(targetIndex)];
  if (!preset) {
    return null;
  }

  const roomInteractions = preset.roomId && preset.roomInteractions
    ? {
      [`${campaignSessionKey}:${preset.roomId}`]: preset.roomInteractions,
    }
    : {};

  return {
    inventoryItems: preset.inventoryItems,
    roomInteractions,
  };
}

const GameContainerShell: React.FC<GameContainerShellProps> = ({ campaignId, onExit }) => {
  const { t } = useTranslation();
  const puzzleRegistry = registry as PuzzleRegistry;
  const { session, setLevelIndex, addInventoryItem, recordDecisionOutcome, markStatus, patchSession, clearPersistedSession } = useGameSession();
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionType, setTransitionType] = useState<'FORWARD' | 'BACKWARD'>('FORWARD');
  const [isNotepadOpen, setIsNotepadOpen] = useState<boolean>(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState<boolean>(false);
  const [isDebugMenuOpen, setIsDebugMenuOpen] = useState<boolean>(false);
  const [autoSeedProgress, setAutoSeedProgress] = useState<boolean>(true);
  const currentLevelIndex = session.levelIndex;
  const campaignSessionKey = session.sessionId;
  const campaign = puzzleRegistry.campaigns[campaignId];
  const puzzleConfig = campaign?.levels[session.levelIndex];
  const currentLevelId = puzzleConfig?.id;
  const isDebugToolsEnabled = import.meta.env.DEV;
  const theme = campaign?.theme ?? getCampaignTheme(campaignId);

  useEffect(() => {
    if (!isDebugToolsEnabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setIsDebugMenuOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDebugToolsEnabled]);

  useEffect(() => {
    const resolveNextLevelIndex = (requestedLevel: number | string) => {
      if (!campaign) {
        return currentLevelIndex + 1;
      }

      if (requestedLevel === 'NEXT') {
        return currentLevelIndex + 1;
      }

      if (requestedLevel === 'COMPLETE') {
        return campaign.levels.length;
      }

      if (typeof requestedLevel === 'number') {
        return requestedLevel;
      }

      const levelIndex = campaign.levels.findIndex((level) => level.id === requestedLevel);
      return levelIndex >= 0 ? levelIndex : currentLevelIndex + 1;
    };

    const resolveDecisionTarget = (requestedLevel: number | string, outcomeId?: string) => {
      if (!campaign || !currentLevelId || requestedLevel !== 'NEXT') {
        return requestedLevel;
      }

      const routeConfig = campaign.decisionRoutes?.[currentLevelId];
      if (!routeConfig) {
        return requestedLevel;
      }

      const resolvedOutcome = outcomeId
        ?? session.decisionOutcomes[currentLevelId]
        ?? routeConfig.defaultOutcome;

      if (!resolvedOutcome) {
        return requestedLevel;
      }

      return routeConfig.routes[resolvedOutcome] ?? requestedLevel;
    };

    const handlePuzzleSolved = ({ nextLevel, outcomeId }: { nextLevel: number | string; outcomeId?: string }) => {
      if (currentLevelId && outcomeId) {
        recordDecisionOutcome(currentLevelId, outcomeId);
      }

      setTransitionType('FORWARD');
      setIsTransitioning(true);
      setTimeout(() => {
        const routedNextLevel = resolveDecisionTarget(nextLevel, outcomeId);
        const nextLevelIndex = resolveNextLevelIndex(routedNextLevel);
        setLevelIndex(nextLevelIndex);
        if (nextLevelIndex >= (campaign?.levels.length ?? 0)) {
          markStatus('completed');
          gameEvents.publish('CAMPAIGN_COMPLETED', { campaignId });
          clearPersistedSession();
        }
        setIsTransitioning(false);
      }, PUZZLE_FORWARD_TRANSITION_MS);
    };

    const handlePuzzleClosed = () => {
      setTransitionType('BACKWARD');
      setIsTransitioning(true);
      setTimeout(() => {
        setLevelIndex(Math.max(0, currentLevelIndex - 1));
        setIsTransitioning(false);
      }, PUZZLE_BACKWARD_TRANSITION_MS);
    };

    const handleGameOver = () => {
      setIsGameOver(true);
      markStatus('failed');
      audio.playDeny();
    };

    const handleItemFound = (item: string) => {
      addInventoryItem(item);
    };

    const unsubscribeSolved = gameEvents.subscribe('PUZZLE_SOLVED', handlePuzzleSolved);
    const unsubscribeClosed = gameEvents.subscribe('PUZZLE_CLOSED', handlePuzzleClosed);
    const unsubscribeFail = gameEvents.subscribe('CAMPAIGN_FAILED', handleGameOver);
    const unsubscribeItemFound = gameEvents.subscribe('ITEM_FOUND', handleItemFound);

    return () => {
      unsubscribeSolved();
      unsubscribeClosed();
      unsubscribeFail();
      unsubscribeItemFound();
    };
  }, [addInventoryItem, campaign, campaignId, clearPersistedSession, currentLevelId, currentLevelIndex, markStatus, recordDecisionOutcome, session.decisionOutcomes, setLevelIndex]);

  const handleExitToMenu = (discardRun = false) => {
    setIsExitConfirmOpen(false);
    setIsInventoryOpen(false);
    setIsNotepadOpen(false);
    setIsDebugMenuOpen(false);
    setIsGameOver(false);
    if (discardRun || session.status !== 'active') {
      clearPersistedSession();
    }
    onExit();
  };

  const handleDebugJump = (targetIndex: number) => {
    if (!campaign || targetIndex < 0 || targetIndex >= campaign.levels.length) {
      return;
    }

    const progressPreset = autoSeedProgress
      ? getDebugProgressPreset(campaign, targetIndex, campaignSessionKey)
      : null;

    audio.playClick();
    setIsTransitioning(false);
    setIsGameOver(false);
    setIsExitConfirmOpen(false);
    setIsInventoryOpen(false);
    setIsNotepadOpen(false);
    setIsDebugMenuOpen(false);

    patchSession({
      levelIndex: targetIndex,
      status: 'active',
      ...(progressPreset ? {
        inventoryItems: progressPreset.inventoryItems,
        roomInteractions: progressPreset.roomInteractions,
      } : {}),
    });
  };

  // Dynamic import with React.lazy
  const ActivePuzzle = useMemo(() => {
    if (!puzzleConfig) {
      return null;
    }

    const modulePath = `../features/puzzles/${puzzleConfig.componentPath}/index.tsx`;
    const loader = puzzleModules[modulePath];

    if (!loader) {
      throw new Error(`Puzzle module not found: ${modulePath}`);
    }

    return React.lazy(async () => {
      const module = await loader();
      return {
        default: (module as { default: React.ComponentType<PuzzleComponentProps> }).default,
      };
    });
  }, [puzzleConfig?.componentPath]);

  return (
    <div className="w-full h-full min-h-screen bg-bg-dark flex flex-col items-center justify-center p-4 overflow-hidden relative font-sans text-slate-200">

      {/* Header UI */}
      <header className="absolute top-0 z-10 flex w-full items-center justify-between px-6 py-1.5">
        <div>
          <h1
            className="text-lg font-bold bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(90deg, ${theme.secondary}, ${theme.primary})` }}
          >
            {t('system.title')} {t('system.os')}
          </h1>
          <p className="text-slate-500 text-xs font-mono">{t('system.version')}</p>
        </div>

        <div className="flex items-center gap-6">
          {/* Global Campaign Timer */}
          <CampaignTimer key={session.sessionId} />

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-slate-300">{t(`campaigns.${campaignId}.grade`, { defaultValue: `Grade ${campaignId.split('_')[1]}` })} - {t('gameContainer.level', { defaultValue: 'Level' })} {currentLevelIndex + 1}</div>
              <div className="text-xs text-slate-500 mt-1">{t(`campaigns.${campaignId}.title`, { defaultValue: `Campaign ${campaignId}` })}</div>
            </div>
            <div
              className="w-10 h-10 rounded-full border-2 flex items-center justify-center bg-surface-dark"
              style={{ borderColor: theme.primary, boxShadow: `0 0 15px ${withAlpha(theme.primary, 0.3)}` }}
            >
              <span className="font-mono font-bold" style={{ color: theme.secondary }}>{currentLevelIndex + 1}</span>
            </div>

            {/* Inventory Toggle Button */}
            <button
              onClick={() => {
                audio.playClick();
                setIsInventoryOpen(true);
              }}
              className="ml-4 w-10 h-10 flex items-center justify-center rounded border transition-colors"
              style={{
                borderColor: withAlpha(theme.primary, 0.4),
                backgroundColor: withAlpha(theme.primary, 0.1),
                color: theme.secondary,
                boxShadow: `0 0 10px ${withAlpha(theme.primary, 0.2)}`,
              }}
              title={t('inventory.title', { defaultValue: 'INVENTORY' })}
            >
              <Box size={18} />
            </button>

            {/* Notepad Toggle Button */}
            <button
              onClick={() => {
                audio.playClick();
                setIsNotepadOpen(true);
              }}
              className="ml-2 w-10 h-10 flex items-center justify-center rounded border transition-colors"
              style={{
                borderColor: withAlpha(theme.primary, 0.4),
                backgroundColor: withAlpha(theme.primary, 0.1),
                color: theme.secondary,
                boxShadow: `0 0 10px ${withAlpha(theme.primary, 0.2)}`,
              }}
              title={t('notepad.title')}
            >
              <FileText size={18} />
            </button>

            {/* Return to OS Button */}
            <button
              onClick={() => setIsExitConfirmOpen(true)}
              className="ml-4 px-4 py-2 border border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded font-mono text-xs tracking-wider transition-colors"
            >
              {t('gameContainer.abortButton')}
            </button>

            {isDebugToolsEnabled && (
              <button
                onClick={() => {
                  audio.playClick();
                  setIsDebugMenuOpen((prev) => !prev);
                }}
                className="ml-2 flex items-center gap-2 rounded border border-amber-400/50 bg-amber-500/10 px-3 py-2 font-mono text-xs tracking-wider text-amber-200 transition-colors hover:bg-amber-500/20"
                title={t('gameContainer.debug.openTitle')}
              >
                <Bug size={14} />
                DEBUG
              </button>
            )}
          </div>
        </div>
      </header>

      {isDebugToolsEnabled && isDebugMenuOpen && campaign && (
        <div className="absolute right-6 top-16 z-40 w-full max-w-sm max-h-[calc(100vh-5.5rem)] overflow-hidden rounded-2xl border border-amber-400/40 bg-slate-950/95 p-4 shadow-[0_0_40px_rgba(245,158,11,0.18)] backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-amber-300">{t('gameContainer.debug.title')}</div>
              <div className="mt-1 text-sm text-slate-300">{t('gameContainer.debug.body')}</div>
            </div>
            <button
              onClick={() => {
                audio.playClick();
                setIsDebugMenuOpen(false);
              }}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200"
            >
              {t('gameContainer.debug.close')}
            </button>
          </div>

          <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={autoSeedProgress}
              onChange={(event) => setAutoSeedProgress(event.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-amber-400 focus:ring-amber-400"
            />
            <span>
              {t('gameContainer.debug.autoSeed')}
            </span>
          </label>

          <div className="mt-4 max-h-[calc(100vh-15rem)] overflow-y-auto pr-1 custom-scrollbar">
            <div className="space-y-2">
              {campaign.levels.map((level, index) => {
                const isActive = index === session.levelIndex;
                return (
                  <button
                    key={`${level.id}-${index}`}
                    onClick={() => handleDebugJump(index)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${isActive
                      ? 'border-amber-300/70 bg-amber-500/12 text-amber-100'
                      : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-amber-400/40 hover:bg-slate-900'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">{t('gameContainer.debug.screenLabel', { index: index + 1 })}</span>
                      {isActive && <span className="rounded border border-amber-300/40 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200">{t('common.active')}</span>}
                    </div>
                    <div className="mt-2 font-mono text-sm text-slate-100">{level.id}</div>
                    <div className="mt-1 text-xs text-slate-500">{level.componentPath}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 text-[11px] font-mono uppercase tracking-[0.16em] text-slate-500">
            {t('gameContainer.debug.shortcut')}
          </div>
        </div>
      )}

      {/* Main Game Area */}
      <main className="relative mb-3 mt-10 min-h-0 w-full max-w-7xl flex-1 overflow-hidden rounded-2xl border border-slate-700/50 bg-surface-dark shadow-2xl backdrop-blur-sm">
        <AnimatePresence mode="wait">
          {!isTransitioning && puzzleConfig && ActivePuzzle ? (
            <motion.div
              key={session.levelIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="w-full h-full absolute inset-0 overflow-hidden"
            >
              <Suspense fallback={<PuzzleLoadingFallback moduleName={puzzleConfig.componentPath} />}>
                <ActivePuzzle
                  campaignId={campaignId}
                  levelId={puzzleConfig.id}
                  config={puzzleConfig}
                  campaignSessionKey={campaignSessionKey}
                />
              </Suspense>
            </motion.div>
          ) : !isTransitioning ? (
            <motion.div
              key="complete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full absolute inset-0"
            >
              <CampaignDebrief campaignId={campaignId} onExit={() => handleExitToMenu(true)} />
            </motion.div>
          ) : (
            <motion.div
              key="transition"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full absolute inset-0 z-50 overflow-hidden bg-slate-950/92 backdrop-blur-md"
            >
              <div className="absolute inset-0" style={{ background: `radial-gradient(circle at top, ${withAlpha(theme.primary, 0.16)}, rgba(2,6,23,1) 64%)` }} />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(30,41,59,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,0.45)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-20" />
              <div className="relative flex h-full items-center justify-center px-6">
                <div
                  className="w-full max-w-xl rounded-[1.75rem] border bg-slate-950/84 p-8 text-center"
                  style={{ borderColor: withAlpha(theme.primary, 0.3), boxShadow: `0 0 44px ${withAlpha(theme.primary, 0.16)}` }}
                >
                  <div className="text-[11px] font-mono uppercase tracking-[0.34em]" style={{ color: theme.secondary }}>{t('gameContainer.transitionTitle')}</div>
                  <div className="mt-4 text-2xl font-mono uppercase tracking-[0.2em] text-slate-100">
                    {transitionType === 'FORWARD' ? t('gameContainer.purging') : t('gameContainer.returning', { defaultValue: 'RETURNING TO HUB...' })}
                  </div>
                  <div className="relative mt-6 h-2 overflow-hidden rounded-full bg-slate-900">
                    <motion.div
                      className="absolute inset-y-0 w-1/2 rounded-full"
                      style={{ backgroundImage: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary}, ${theme.primary})`, boxShadow: `0 0 18px ${withAlpha(theme.primary, 0.35)}` }}
                      animate={{ x: ['-110%', '220%'] }}
                      transition={{ duration: 1.25, ease: 'easeInOut', repeat: Infinity }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Inventory UI */}
      <InventorySystem isOpen={isInventoryOpen} onClose={() => setIsInventoryOpen(false)} />

      {/* Global Notepad Overlay */}
      <Notepad key={session.sessionId} isOpen={isNotepadOpen} onClose={() => setIsNotepadOpen(false)} />

      {/* Exit Confirmation */}
      <AnimatePresence>
        {isExitConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsExitConfirmOpen(false)}
          >
            <motion.div
              initial={{ y: 20, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-red-500/40 bg-slate-950/95 p-6 shadow-[0_0_40px_rgba(239,68,68,0.2)]"
            >
              <h2 className="text-xl font-mono font-bold tracking-widest text-red-300 uppercase">{t('gameContainer.exitConfirmTitle')}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {t('gameContainer.exitConfirmBody', { campaign: t(`campaigns.${campaignId}.title`, { defaultValue: `Campaign ${campaignId}` }) })}
              </p>
              <p className="mt-2 text-xs font-mono uppercase tracking-wider text-slate-500">
                {t('gameContainer.exitConfirmNote')}
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setIsExitConfirmOpen(false)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-sm tracking-wider text-slate-300 transition-colors hover:bg-slate-800"
                >
                  {t('gameContainer.continueRun')}
                </button>
                <button
                  onClick={() => handleExitToMenu(true)}
                  className="flex-1 rounded-lg border border-red-400/70 bg-red-600 px-4 py-3 font-mono text-sm font-bold tracking-wider text-white transition-colors hover:bg-red-500"
                >
                  {t('gameContainer.exitToMenu')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Screen */}
      <AnimatePresence>
        {isGameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-red-950/90 backdrop-blur-md flex flex-col items-center justify-center text-red-500 overflow-hidden"
          >
            <div className="absolute inset-x-0 inset-y-0 crt-effect opacity-50 pointer-events-none" />
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
              className="flex flex-col items-center justify-center p-12 bg-black/60 border-2 border-red-500/50 rounded-2xl shadow-[0_0_100px_rgba(239,68,68,0.4)] relative z-10 text-center max-w-lg w-full"
            >
              <ShieldAlert size={80} className="mb-6 animate-pulse" />
              <h1 className="text-5xl font-mono font-bold tracking-widest mb-2 uppercase">{t('gameContainer.gameOverTitle')}</h1>
              <p className="text-red-400 font-mono tracking-wider mb-8 uppercase text-sm">{t('gameContainer.gameOverBody')}</p>

              <button
                onClick={() => handleExitToMenu(true)}
                className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-mono font-bold tracking-widest rounded transition-all shadow-[0_0_20px_rgba(239,68,68,0.5)] border border-red-400"
              >
                {t('gameContainer.returnToMainMenu')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export const GameContainer: React.FC<GameContainerProps> = ({ campaignId, onExit, initialSession }) => {
  const campaign = registry.campaigns[campaignId];
  const initialTimeSeconds = (campaign?.timeLimitMinutes ?? DEFAULT_CAMPAIGN_TIME_MINUTES) * 60;

  return (
    <GameSessionProvider
      key={`${campaignId}:${initialSession?.sessionId ?? 'fresh'}`}
      campaignId={campaignId}
      initialTimeSeconds={initialTimeSeconds}
      initialSnapshot={initialSession}
    >
      <GameErrorBoundary onReset={() => onExit()}>
        <GameContainerShell campaignId={campaignId} onExit={onExit} />
      </GameErrorBoundary>
    </GameSessionProvider>
  );
};

function PuzzleLoadingFallback({ moduleName }: { moduleName: string }) {
  const { t } = useTranslation();
  const theme = getCampaignTheme();

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at top, ${withAlpha(theme.primary, 0.18)}, rgba(2,6,23,1) 65%)` }} />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(30,41,59,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,0.45)_1px,transparent_1px)] bg-[size:3.25rem_3.25rem] opacity-20" />
      <div className="relative flex h-full items-center justify-center p-6">
        <div
          className="w-full max-w-lg rounded-[1.75rem] border bg-slate-950/84 px-8 py-7 text-center"
          style={{ borderColor: withAlpha(theme.primary, 0.3), boxShadow: `0 0 38px ${withAlpha(theme.primary, 0.16)}` }}
        >
          <div className="text-[11px] font-mono uppercase tracking-[0.34em] text-slate-500">{t('gameContainer.loadingTitle')}</div>
          <div className="mt-3 text-lg font-mono uppercase tracking-[0.22em]" style={{ color: theme.secondary }}>{moduleName}</div>
          <div className="relative mt-6 h-2 overflow-hidden rounded-full bg-slate-900">
            <motion.div
              className="absolute inset-y-0 w-1/2 rounded-full"
              style={{ backgroundImage: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary}, ${theme.primary})`, boxShadow: `0 0 18px ${withAlpha(theme.primary, 0.35)}` }}
              animate={{ x: ['-110%', '220%'] }}
              transition={{ duration: 1.25, ease: 'easeInOut', repeat: Infinity }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
