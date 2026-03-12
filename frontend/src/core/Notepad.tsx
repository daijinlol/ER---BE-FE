import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, FileText, Save } from 'lucide-react';
import { audio } from './AudioEngine';
import { NOTE_SAVE_DEBOUNCE_MS } from './gameConstants';
import { useGameSession } from './GameSession';

interface NotepadProps {
    isOpen: boolean;
    onClose: () => void;
}

export const Notepad: React.FC<NotepadProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { session, setNotes } = useGameSession();
    const [notes, setLocalNotes] = useState(session.notes);
    const [lastSavedNotes, setLastSavedNotes] = useState(session.notes);

    useEffect(() => {
        if (notes === lastSavedNotes) {
            return;
        }

        const timer = setTimeout(() => {
            setNotes(notes);
            setLastSavedNotes(notes);
        }, NOTE_SAVE_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [lastSavedNotes, notes, setNotes]);

    const isSaved = notes === lastSavedNotes;

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

                    {/* Notepad Panel */}
                    <motion.div
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-8 top-24 w-80 h-[500px] z-[70] bg-surface-dark border-2 border-brand-500/50 shadow-[0_0_30px_rgba(59,130,246,0.3)] flex flex-col rounded-xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-brand-500/30 bg-bg-dark/50">
                            <div className="flex items-center gap-3 text-brand-400">
                                <FileText size={20} />
                                <h2 className="font-mono tracking-widest uppercase font-bold text-sm">
                                    {t('notepad.title')}
                                </h2>
                            </div>
                            <div className="flex items-center gap-4">
                                <AnimatePresence>
                                    {isSaved && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex items-center gap-1 text-xs text-green-400 font-mono"
                                        >
                                            <Save size={14} /> {t('notepad.saved', { defaultValue: 'SAVED' })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
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
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 p-6 relative">
                            {/* Terminal scanline effect overlay */}
                            <div className="absolute inset-x-6 inset-y-6 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20 z-10" />

                            <textarea
                                value={notes}
                                onChange={(e) => {
                                    setLocalNotes(e.target.value);
                                }}
                                placeholder={t('notepad.placeholder')}
                                className="w-full h-full bg-slate-900/50 text-brand-100 font-handwriting p-4 rounded border border-brand-500/20 focus:outline-none focus:border-brand-500/50 resize-none custom-scrollbar shadow-inner relative z-0 placeholder:text-slate-600/50"
                                spellCheck={false}
                            />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
