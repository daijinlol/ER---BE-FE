import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { gameEvents } from './EventBus';
import { Box } from 'lucide-react';

export const InventorySystem: React.FC = () => {
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
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-surface-dark border border-slate-700 rounded-xl p-4 shadow-2xl flex gap-4 min-w-[300px] justify-center text-slate-300">
      <h3 className="absolute -top-3 left-4 bg-surface-dark px-2 text-xs font-bold uppercase tracking-wider text-slate-400">{t('inventory.title')}</h3>
      <AnimatePresence>
        {items.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm italic text-slate-500 py-2">
            {t('inventory.empty')}
          </motion.div>
        )}
        {items.map((item) => (
          <motion.div
            key={item}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ y: -5, scale: 1.1 }}
            className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-600 shadow-inner group relative cursor-pointer"
            title={t(`items.${item}`, { defaultValue: item.replace('_', ' ') }) as string}
          >
            <Box size={24} className="text-brand-400 group-hover:text-brand-300 transition-colors" />
            {/* Tooltip */}
            <div className="absolute -top-8 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {t(`items.${item}`, { defaultValue: item.replace('_', ' ') }) as string}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
