import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { gameEvents } from './EventBus';
import { Box, X } from 'lucide-react';
import { audio } from './AudioEngine';

interface InventorySystemProps {
    isOpen: boolean;
    onClose: () => void;
}

export const InventorySystem: React.FC<InventorySystemProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    const handleItemFound = (item: string) => {
      setItems(prev => {
        if (!prev.includes(item)) {
          return [...prev, item];
        }
        return prev;
      });
    };

    const unsubscribe = gameEvents.subscribe('ITEM_FOUND', handleItemFound);
    return () => unsubscribe();
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                  audio.playClick();
                  onClose();
              }}
              className="fixed inset-0 z-[60] bg-black/10 backdrop-blur-[2px]"
          />
          
          {/* Inventory Panel */}
          <motion.div 
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-8 top-24 w-80 h-[500px] z-[70] bg-surface-dark border-2 border-brand-500/50 shadow-[0_0_30px_rgba(59,130,246,0.3)] flex flex-col rounded-xl overflow-hidden"
          >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-brand-500/30 bg-bg-dark/50">
                  <div className="flex items-center gap-3 text-brand-400">
                      <Box size={20} />
                      <h2 className="font-mono tracking-widest uppercase font-bold text-sm">
                          {t('inventory.title', { defaultValue: 'INVENTORY' })}
                      </h2>
                  </div>
                  <button 
                      onClick={() => {
                          audio.playClick();
                          onClose();
                      }}
                      className="p-1 rounded text-slate-400 hover:text-brand-400 hover:bg-brand-500/20 transition-colors"
                  >
                      <X size={20} />
                  </button>
              </div>

              {/* Items Area */}
              <div className="flex-1 p-6 relative overflow-y-auto custom-scrollbar">
                  {/* Terminal scanline effect overlay */}
                  <div className="absolute inset-x-6 inset-y-6 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 z-10" />
                  
                  <div className="relative z-20 grid grid-cols-2 gap-6 place-items-center mt-2 pb-6">
                      {Array.from({ length: 6 }).map((_, i) => {
                          const item = items[i];
                          
                          if (!item) {
                              // Empty slot
                              return (
                                  <div 
                                      key={`empty-${i}`} 
                                      className="w-24 h-24 bg-slate-900/60 rounded-xl flex items-center justify-center border-2 border-slate-800/80 border-dashed shadow-inner"
                                  />
                              );
                          }

                          // Filled slot
                          return (
                              <motion.div
                                  key={item}
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  whileHover={{ scale: 1.05 }}
                                  className="w-24 h-24 bg-slate-800 rounded-xl flex items-center justify-center border-2 border-slate-600 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)] group relative cursor-pointer hover:border-brand-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all"
                              >
                                  <Box size={36} className="text-brand-400 group-hover:text-brand-300 transition-colors drop-shadow-md" />
                                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30 border border-slate-700 text-slate-200">
                                      {t(`items.${item}`, { defaultValue: item.replace('_', ' ') }) as string}
                                  </div>
                              </motion.div>
                          );
                      })}
                  </div>
              </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
