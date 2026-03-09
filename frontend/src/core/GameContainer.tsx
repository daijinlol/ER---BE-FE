import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { gameEvents } from './EventBus';
import registry from '../features/puzzles/registry.json';
import { InventorySystem } from './InventorySystem';
import { CampaignTimer } from './CampaignTimer';
import { Notepad } from './Notepad';
import { FileText } from 'lucide-react';
import { audio } from './AudioEngine';

interface GameContainerProps {
  campaignId: string;
}

export const GameContainer: React.FC<GameContainerProps> = ({ campaignId }) => {
  const { t } = useTranslation();
  const [currentLevelIndex, setCurrentLevelIndex] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionType, setTransitionType] = useState<'FORWARD' | 'BACKWARD'>('FORWARD');
  const [isNotepadOpen, setIsNotepadOpen] = useState<boolean>(false);

  useEffect(() => {
    const handlePuzzleSolved = () => {
      setTransitionType('FORWARD');
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentLevelIndex((prev) => prev + 1);
        setIsTransitioning(false);
      }, 1500);
    };

    const handlePuzzleClosed = () => {
      setTransitionType('BACKWARD');
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentLevelIndex((prev) => Math.max(0, prev - 1));
        setIsTransitioning(false);
      }, 800);
    };

    const unsubscribeSolved = gameEvents.subscribe('PUZZLE_SOLVED', handlePuzzleSolved);
    const unsubscribeClosed = gameEvents.subscribe('PUZZLE_CLOSED', handlePuzzleClosed);
    
    return () => {
      unsubscribeSolved();
      unsubscribeClosed();
    };
  }, []);

  // Find current campaign and puzzle
  const campaign = (registry.campaigns as any)[campaignId];
  const puzzleConfig = campaign?.levels[currentLevelIndex];

  // Dynamic import with React.lazy
  const ActivePuzzle = puzzleConfig
    ? React.lazy(() => import(`../features/puzzles/${puzzleConfig.componentPath}/index.tsx`))
    : () => <div className="text-brand-400 text-2xl animate-pulse font-mono tracking-widest">{t('gameContainer.campaignComplete', { defaultValue: 'CAMPAIGN COMPLETE. AWAITING NEW DIRECTIVE...' })}</div>;

  return (
    <div className="w-full h-full min-h-screen bg-bg-dark flex flex-col items-center justify-center p-8 overflow-hidden relative font-sans text-slate-200">

      {/* Header UI */}
      <header className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-indigo-400">
            {t('system.title')} {t('system.os')}
          </h1>
          <p className="text-slate-500 text-sm font-mono mt-1">{t('system.version')}</p>
        </div>

        <div className="flex items-center gap-6">
          {/* Global Campaign Timer */}
          <CampaignTimer initialMinutes={45} />

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-slate-300">{t(`campaigns.${campaignId}.grade`, { defaultValue: `Grade ${campaignId.split('_')[1]}` })} - {t('gameContainer.level', { defaultValue: 'Level' })} {currentLevelIndex + 1}</div>
              <div className="text-xs text-slate-500 mt-1">{t(`campaigns.${campaignId}.title`, { defaultValue: `Campaign ${campaignId}` })}</div>
            </div>
            <div className="w-12 h-12 rounded-full border-2 border-brand-500 flex items-center justify-center bg-surface-dark shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <span className="font-mono font-bold text-brand-400">{currentLevelIndex + 1}</span>
            </div>
            
            {/* Notepad Toggle Button */}
            <button 
              onClick={() => {
                audio.playClick();
                setIsNotepadOpen(true);
              }}
              className="ml-2 w-10 h-10 flex items-center justify-center rounded border border-brand-500/40 bg-brand-500/10 text-brand-400 hover:bg-brand-500/30 hover:text-brand-300 transition-colors shadow-[0_0_10px_rgba(59,130,246,0.2)]"
              title={t('notepad.title')}
            >
              <FileText size={18} />
            </button>

            {/* Return to OS Button */}
            <button 
              onClick={() => window.location.reload()} 
              className="ml-4 px-4 py-2 border border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded font-mono text-xs tracking-wider transition-colors"
            >
              ABORT PROTOCOL
            </button>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="w-full max-w-5xl flex-1 mt-20 mb-24 relative border border-slate-700/50 rounded-2xl bg-surface-dark shadow-2xl overflow-hidden backdrop-blur-sm">
        <AnimatePresence mode="wait">
          {!isTransitioning && puzzleConfig ? (
            <motion.div
              key={currentLevelIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="w-full h-full absolute inset-0 overflow-y-auto"
            >
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center text-brand-500 animate-pulse font-mono flex-col gap-4">
                  <div className="w-8 h-8 border-t-2 border-brand-500 rounded-full animate-spin"></div>
                  {t('gameContainer.loadingModule', { module: puzzleConfig.componentPath })}
                </div>
              }>
                <ActivePuzzle config={puzzleConfig} />
              </Suspense>
            </motion.div>
          ) : (
            <motion.div
              key="transition"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex items-center justify-center absolute inset-0 bg-bg-dark/80 backdrop-blur-md z-50 text-indigo-300 font-mono text-xl tracking-widest"
            >
              {transitionType === 'FORWARD' ? t('gameContainer.purging') : t('gameContainer.returning', { defaultValue: 'RETURNING TO HUB...' })}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Inventory UI */}
      <InventorySystem />

      {/* Global Notepad Overlay */}
      <Notepad isOpen={isNotepadOpen} onClose={() => setIsNotepadOpen(false)} />

    </div>
  );
};
