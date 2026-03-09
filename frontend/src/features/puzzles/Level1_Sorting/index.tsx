import React, { useState, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { gameEvents } from '../../../core/EventBus';
import { usePuzzleValidation } from '../../../hooks/usePuzzleValidation';
import { audio } from '../../../core/AudioEngine';
import { Lock, Unlock, Server, Database, Cpu, HardDrive, Terminal, X } from 'lucide-react';

const ITEM_ICONS: Record<string, React.ReactNode> = {
  cpu: <Cpu className="text-blue-400" />,
  ram: <Server className="text-green-400" />,
  storage: <HardDrive className="text-yellow-400" />,
  gpu: <Database className="text-purple-400" />,
};

const ITEMS_LIST = ['storage', 'ram', 'cpu', 'gpu'];

export default function Level1Sorting() {
  const { t } = useTranslation();
  const { validate } = usePuzzleValidation('elem_6', '1');
  const [items, setItems] = useState([...ITEMS_LIST].sort(() => Math.random() - 0.5));
  const [isSolved, setIsSolved] = useState(false);
  const [terminalKey, setTerminalKey] = useState("level1.awaitingAlignment");

  // Dev shortcut to auto-solve
  const debugSolve = () => {
     setItems(['cpu', 'ram', 'gpu', 'storage']);
  };

  useEffect(() => {
    if (isSolved) return;

    const timeoutId = setTimeout(async () => {
      const check = await validate({ items });
      
      if (check.success && !isSolved) {
        setIsSolved(true);
        setTerminalKey("level1.sequenceAccepted");
        
        // Play success audio
        audio.playSuccess();
        
        // Award items from backend
        setTimeout(() => {
          check.unlocks.forEach(item => {
              gameEvents.publish('ITEM_FOUND', item);
          });
          audio.playItemFound();
          setTerminalKey("level1.tokenGranted");
        }, 1500);

        setTimeout(() => {
          gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 2 });
        }, 3500);
      } else if (!check.success && !isSolved) {
          setTerminalKey("level1.awaitingAlignment");
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [items, isSolved]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-900 overflow-hidden relative" onClick={() => gameEvents.publish('PUZZLE_CLOSED')}>
      {/* Environmental overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0%,rgba(15,23,42,1)_100%)] pointer-events-none" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-2xl w-full z-10 flex flex-col gap-8 cursor-default" onClick={(e) => e.stopPropagation()}>
        
        {/* Terminal Header */}
        <div className="bg-black/50 border border-slate-700/50 rounded-xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Terminal 
                   className="text-slate-400 cursor-help" 
                   onDoubleClick={debugSolve} 
                />
                <h2 className="text-xl font-mono text-slate-200 uppercase tracking-widest">{t('level1.title')}</h2>
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
           <p className="font-mono text-sm text-brand-400 min-h-[40px] border-l-2 border-brand-500 pl-3">
              {t(terminalKey)}
              <motion.span 
                 animate={{ opacity: [1, 0] }} 
                 transition={{ repeat: Infinity, duration: 0.8 }}
                 className="inline-block w-2 h-4 bg-brand-400 ml-1 translate-y-1" 
              />
           </p>
        </div>

        {/* Puzzle Area */}
        <div className="bg-surface-dark border border-slate-700 rounded-xl p-8 shadow-xl flex flex-col md:flex-row gap-8 items-center">
            
            <div className="flex-1 w-full">
              <h3 className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Server size={16} /> {t('level1.hardwareArray')}
              </h3>
              <Reorder.Group axis="y" values={items} onReorder={(newItems) => {
                 setItems(newItems);
                 audio.playHover();
              }} className="flex flex-col gap-3 w-full">
                {items.map((item) => (
                  <Reorder.Item 
                      key={item} 
                      value={item}
                      id={item}
                      className="group cursor-grab active:cursor-grabbing bg-slate-800 border border-slate-600 rounded-lg p-4 flex items-center justify-between shadow-md hover:border-brand-500 transition-colors relative"
                  >
                     <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-600 group-hover:bg-brand-500 transition-colors rounded-l-lg" />
                     <div className="flex items-center gap-4 ml-2">
                        <div className="w-10 h-10 rounded bg-slate-900 border border-slate-700 flex items-center justify-center">
                           {ITEM_ICONS[item]}
                        </div>
                        <span className="font-mono text-slate-300 uppercase tracking-wider text-sm">{t(`items.${item}`)} {t('level1.module')}</span>
                     </div>
                     <div className="flex items-center gap-1 text-slate-500 opacity-50">
                        <div className="w-1 h-1 rounded-full bg-current" />
                        <div className="w-1 h-1 rounded-full bg-current" />
                        <div className="w-1 h-1 rounded-full bg-current" />
                     </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>

            {/* Door Lock Visualization */}
            <div className="flex flex-col items-center justify-center w-48 h-64 bg-slate-800 rounded-xl border-4 border-slate-900 shadow-inner relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-8 bg-black/40 border-b border-slate-900/50 flex space-around items-center px-4">
                   <div className="w-2 h-2 rounded-full bg-red-500/50 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                   <div className="w-2 h-2 rounded-full bg-red-500/50 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                   <div className="w-2 h-2 rounded-full bg-green-500/50 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                </div>
                
                <motion.div
                   animate={{ 
                      scale: isSolved ? 1.1 : 1,
                      color: isSolved ? '#4ade80' : '#f87171'
                   }}
                   className="text-slate-500 transition-colors duration-1000 z-10"
                >
                   {isSolved ? <Unlock size={64} className="text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]" /> : <Lock size={64} className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />}
                </motion.div>
                
                <div className="mt-4 font-mono text-xs uppercase tracking-widest text-slate-500 text-center px-2">
                   {isSolved ? <span className="text-green-400 font-bold">{t('level1.accessGranted')}</span> : t('level1.secureArea')}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}
