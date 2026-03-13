import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Box, FileText, Wrench, X } from 'lucide-react';
import { audio } from './AudioEngine';
import { useGameSession } from './GameSession';
import { getInventoryItemCatalogEntry, type InventoryItemKind } from './itemCatalog';

interface InventorySystemProps {
    isOpen: boolean;
    onClose: () => void;
}

export const InventorySystem: React.FC<InventorySystemProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { session } = useGameSession();
    const items = session.inventoryItems;
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [openedDocumentItem, setOpenedDocumentItem] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setOpenedDocumentItem(null);
            return;
        }

        setSelectedItem((current) => {
            if (current && items.includes(current)) {
                return current;
            }

            return items[0] ?? null;
        });
    }, [isOpen, items]);

    const selectedItemEntry = useMemo(
        () => (selectedItem ? getInventoryItemCatalogEntry(selectedItem) : null),
        [selectedItem],
    );
    const openedDocumentEntry = useMemo(
        () => (openedDocumentItem ? getInventoryItemCatalogEntry(openedDocumentItem) : null),
        [openedDocumentItem],
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <>
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

                    <motion.div
                        initial={{ x: '-100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '-100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed left-4 right-4 top-20 z-[70] flex h-[min(78vh,46rem)] w-auto max-w-[42rem] flex-col overflow-hidden rounded-2xl border-2 border-brand-500/50 bg-surface-dark shadow-[0_0_30px_rgba(59,130,246,0.3)] md:left-8 md:right-auto md:w-[42rem]"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-brand-500/30 bg-bg-dark/50">
                            <div className="flex items-center gap-3 text-brand-400">
                                <Box size={20} />
                                <h2 className="font-mono tracking-widest uppercase font-bold text-sm">
                                    {t('inventory.title', { defaultValue: 'INVENTORY' })}
                                </h2>
                            </div>
                            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
                                {t('inventory.count', { count: items.length, defaultValue: `${items.length} items` })}
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

                        <div className="relative flex min-h-0 flex-1 overflow-hidden p-4 md:p-6">
                            <div className="pointer-events-none absolute inset-x-4 inset-y-4 z-10 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 md:inset-x-6 md:inset-y-6" />

                            <div className="relative z-20 grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
                                <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/70">
                                    <div className="border-b border-slate-800 px-4 py-3">
                                        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
                                            {t('inventory.recoveredItems', { defaultValue: 'Recovered Items' })}
                                        </div>
                                    </div>
                                    <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
                                        {items.length === 0 ? (
                                            <div className="flex h-full min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 px-6 text-center text-sm text-slate-500">
                                                {t('inventory.emptyState', { defaultValue: 'No recovered items yet.' })}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                                                {items.map((item) => {
                                                    const entry = getInventoryItemCatalogEntry(item);
                                                    const isSelected = selectedItem === item;
                                                    const Icon = getInventoryIcon(entry.kind);

                                                    return (
                                                        <motion.button
                                                            key={item}
                                                            initial={{ scale: 0.96, opacity: 0 }}
                                                            animate={{ scale: 1, opacity: 1 }}
                                                            whileHover={{ scale: 1.02 }}
                                                            onClick={() => {
                                                                audio.playClick();
                                                                setSelectedItem(item);
                                                            }}
                                                            className={`group rounded-2xl border p-3 text-left transition-all ${isSelected
                                                                ? 'border-brand-400 bg-brand-500/15 shadow-[0_0_18px_rgba(59,130,246,0.22)]'
                                                                : 'border-slate-700 bg-slate-900/70 hover:border-brand-500/45 hover:bg-slate-900'}`}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className={`rounded-xl border p-2 ${isSelected ? 'border-brand-400/40 bg-brand-500/15 text-brand-200' : 'border-slate-700 bg-slate-950/80 text-slate-300'}`}>
                                                                    <Icon size={18} />
                                                                </div>
                                                                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                                                                    {t(`inventory.types.${entry.kind}`, { defaultValue: entry.kind })}
                                                                </div>
                                                            </div>
                                                            <div className="mt-3 text-sm font-medium leading-snug text-slate-100">
                                                                {t(`items.${item}`, { defaultValue: item.replace('_', ' ') })}
                                                            </div>
                                                            <div className="mt-2 text-xs leading-relaxed text-slate-400 line-clamp-3">
                                                                {t(entry.summaryKey)}
                                                            </div>
                                                        </motion.button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <section className="flex min-h-0 flex-col rounded-2xl border border-slate-700 bg-slate-950/80">
                                    <div className="border-b border-slate-800 px-4 py-3">
                                        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
                                            {t('inventory.detailLabel', { defaultValue: 'Selected Item' })}
                                        </div>
                                    </div>

                                    <div className="flex min-h-0 flex-1 flex-col p-4">
                                        {selectedItem && selectedItemEntry ? (
                                            <>
                                                <div className="flex items-start gap-3">
                                                    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-brand-300">
                                                        {React.createElement(getInventoryIcon(selectedItemEntry.kind), { size: 20 })}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="text-lg font-semibold text-white">
                                                            {t(`items.${selectedItem}`, { defaultValue: selectedItem })}
                                                        </h3>
                                                        <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
                                                            {t(`inventory.types.${selectedItemEntry.kind}`, { defaultValue: selectedItemEntry.kind })}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm leading-relaxed text-slate-300">
                                                    {t(selectedItemEntry.summaryKey)}
                                                </div>

                                                <div className="mt-4 flex-1 rounded-2xl border border-slate-800 bg-black/20 p-4 text-sm leading-relaxed text-slate-400">
                                                    {selectedItemEntry.readable && selectedItemEntry.bodyKey
                                                        ? t('inventory.readableHint', { defaultValue: 'This recovered document can be opened again at any time.' })
                                                        : t('inventory.unreadableHint', { defaultValue: 'This item is stored equipment, not a readable document.' })}
                                                </div>

                                                {selectedItemEntry.readable && selectedItemEntry.bodyKey && (
                                                    <button
                                                        onClick={() => {
                                                            audio.playClick();
                                                            setOpenedDocumentItem(selectedItem);
                                                        }}
                                                        className="mt-4 rounded-2xl border border-brand-500/40 bg-brand-500/12 px-4 py-3 text-sm font-mono uppercase tracking-[0.18em] text-brand-100 transition-colors hover:bg-brand-500/20"
                                                    >
                                                        {t('inventory.openReadable', { defaultValue: 'Open Document' })}
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 px-6 text-center text-sm text-slate-500">
                                                {t('inventory.selectPrompt', { defaultValue: 'Select an item to inspect its details.' })}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </div>
                    </motion.div>

                    <AnimatePresence>
                        {openedDocumentItem && openedDocumentEntry?.bodyKey && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
                                onClick={() => {
                                    audio.playClick();
                                    setOpenedDocumentItem(null);
                                }}
                            >
                                <motion.div
                                    initial={{ y: 24, scale: 0.98 }}
                                    animate={{ y: 0, scale: 1 }}
                                    exit={{ y: 24, scale: 0.98 }}
                                    onClick={(event) => event.stopPropagation()}
                                    className="w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-slate-700 bg-slate-950/95 shadow-2xl"
                                >
                                    <div className="border-b border-slate-800 bg-black/35 px-6 py-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-brand-300">
                                                    {t('inventory.documentTitle', { defaultValue: 'Recovered Document' })}
                                                </div>
                                                <h3 className="mt-3 text-2xl font-semibold text-white">
                                                    {t(`items.${openedDocumentItem}`, { defaultValue: openedDocumentItem })}
                                                </h3>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    audio.playClick();
                                                    setOpenedDocumentItem(null);
                                                }}
                                                className="rounded-xl border border-slate-700 bg-slate-900/80 p-2 text-slate-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="max-h-[70vh] overflow-y-auto px-6 py-8 custom-scrollbar">
                                        <div className="rounded-2xl border border-brand-400/15 bg-slate-900/70 p-6">
                                            <div className="whitespace-pre-line font-mono text-sm leading-8 text-slate-200">
                                                {t(openedDocumentEntry.bodyKey)}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </AnimatePresence>
    );
};

function getInventoryIcon(kind: InventoryItemKind) {
    if (kind === 'document') {
        return FileText;
    }

    if (kind === 'tool') {
        return Wrench;
    }

    return Box;
}
