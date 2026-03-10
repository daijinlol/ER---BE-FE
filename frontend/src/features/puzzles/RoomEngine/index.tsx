import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Lightbulb, Search, X } from 'lucide-react';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';

interface RoomConfig {
  id: string;
  componentPath: string;
  backgroundUrl: string;
  hotspots: Array<{
    id: string;
    x: number;
    y: number;
    action: 'NEXT_LEVEL' | 'LORE' | 'PUZZLE' | 'DIALOGUE';
    label: string;
    content?: string;
    requires?: string[];
  }>;
}

export default function RoomEngine({ config }: { config: RoomConfig }) {
  const { t } = useTranslation();
  const storageKey = `room_interactions_${config.id}`;
  const [activeLore, setActiveLore] = useState<string | null>(null);
  const [interactionHistory, setInteractionHistory] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleHotspotClick = (hotspot: any) => {
    audio.playClick();
    
    // Track that we interacted with this element
    setInteractionHistory(prev => {
      const next = new Set(prev).add(hotspot.id);
      sessionStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      return next;
    });
    
    if (hotspot.action === 'LORE') {
        setActiveLore(hotspot.content);
    } else if (hotspot.action === 'NEXT_LEVEL') {
        audio.playSuccess();
        gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
    }
  };

  return (
    <div className="w-full h-full relative bg-black overflow-hidden group">
        {/* Environmental Background */}
        {config.backgroundUrl ? (
            <div 
               className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-[10s] group-hover:scale-105 pointer-events-none"
               style={{ backgroundImage: `url(${config.backgroundUrl})` }}
            />
        ) : (
            <div className="absolute inset-0 bg-slate-900 pointer-events-none flex items-center justify-center">
                <span className="text-slate-700 font-mono tracking-widest text-xl">NO VISUAL SIGNAL</span>
            </div>
        )}

        {/* CSS Tint Overlay for Sci-Fi Vibe */}
        <div className="absolute inset-0 bg-brand-900/20 mix-blend-overlay pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black pointer-events-none opacity-80" />

        {/* Hotspots Container */}
        <div className="absolute inset-0 z-10">
            {config.hotspots?.filter((h) => !h.requires || h.requires.every(req => interactionHistory.has(req))).map((hotspot) => (
                <button
                   key={hotspot.id}
                   onClick={() => handleHotspotClick(hotspot)}
                   onMouseEnter={() => audio.playHover()}
                   className="absolute group/spot cursor-pointer transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                   style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                >
                   {/* Glowing marker dot */}
                   <div className="w-6 h-6 rounded-full border-2 border-brand-400 bg-brand-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.6)] group-hover/spot:bg-brand-400 group-hover/spot:scale-125 transition-all">
                      {hotspot.action === 'LORE' ? <Lightbulb size={12} className="text-white" /> : <Search size={12} className="text-white" />}
                   </div>
                   
                   {/* Tooltip Label */}
                   <div className="mt-2 px-3 py-1 bg-black/80 backdrop-blur-sm border border-brand-500/50 text-brand-200 text-xs font-mono rounded transition-all pointer-events-none whitespace-nowrap drop-shadow-md">
                      {t(hotspot.label)}
                   </div>
                </button>
            ))}
        </div>

        {/* Lore / Dialogue Overlay */}
        <AnimatePresence>
            {activeLore && (
                <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-8 cursor-pointer"
                   onClick={() => { audio.playClick(); setActiveLore(null); }}
                >
                    <motion.div 
                       initial={{ y: 50, scale: 0.95 }}
                       animate={{ y: 0, scale: 1 }}
                       exit={{ y: 50, scale: 0.95 }}
                       onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
                       className="w-full max-w-lg bg-surface-dark border border-slate-700 shadow-2xl rounded-xl overflow-hidden relative cursor-default"
                    >
                        <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Terminal className="text-brand-400" size={18} />
                                <span className="text-slate-200 font-mono text-sm tracking-widest font-bold">DATA LOG RECOVERED</span>
                            </div>
                            <button onClick={() => { audio.playClick(); setActiveLore(null); }} className="text-slate-300 bg-red-500/20 p-1 rounded hover:bg-red-500 hover:text-white transition-colors border border-red-500/50">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-8 font-mono text-slate-300 leading-relaxed min-h-[150px] flex items-center justify-center text-center">
                            {t(activeLore)}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}
