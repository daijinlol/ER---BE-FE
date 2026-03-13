import { type ReactNode, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FileText, ScrollText, X } from 'lucide-react';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';
import { useGameSession } from '../../../core/GameSession';

export function closePuzzle() {
    audio.playClick();
    gameEvents.publish('PUZZLE_CLOSED');
}

export function ArchivePuzzleFrame({
    subtitle,
    title,
    story,
    feedback,
    children,
}: {
    subtitle: string;
    title: string;
    story: string;
    feedback?: string;
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <div className="relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-[#140f0a] p-3 text-stone-100 xl:p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12)_0%,rgba(20,15,10,1)_58%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_35%,rgba(0,0,0,0.28)_100%)]" />

            <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-3 xl:gap-4">
                <div className="overflow-hidden rounded-2xl border border-amber-700/30 bg-[#22170d]/90 p-4 shadow-2xl backdrop-blur-md">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="text-xs font-mono uppercase tracking-[0.24em] text-amber-200">{subtitle}</div>
                            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-50 xl:text-3xl">{title}</h2>
                            <p className="mt-3 max-w-4xl text-sm leading-relaxed text-stone-300">{story}</p>
                            {feedback && <p className="mt-3 border-l-2 border-amber-400 pl-3 text-sm leading-relaxed text-amber-100">{feedback}</p>}
                        </div>
                        <button
                            onClick={closePuzzle}
                            className="rounded-xl border border-stone-700 bg-black/25 p-2 text-stone-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                            title={t('common.closeInterface')}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {children}
            </div>
        </div>
    );
}

export function ArchiveStatCard({ label, value, accent = 'amber' }: { label: string; value: string; accent?: 'amber' | 'stone' | 'emerald' }) {
    const palette = accent === 'emerald'
        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
        : accent === 'stone'
            ? 'border-stone-700 bg-black/25 text-stone-100'
            : 'border-amber-600/30 bg-amber-500/10 text-amber-100';

    return (
        <div className={`rounded-2xl border px-4 py-3 ${palette}`}>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-stone-400">{label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
        </div>
    );
}

export function ArchiveButton({
    label,
    onClick,
    disabled = false,
    variant = 'primary',
}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary';
}) {
    const className = variant === 'primary'
        ? 'border-amber-500/40 bg-amber-500/12 text-amber-50 hover:bg-amber-500/20'
        : 'border-stone-700 bg-black/20 text-stone-200 hover:bg-stone-900/70';

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`rounded-xl border px-4 py-3 text-sm font-mono font-bold uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        >
            {label}
        </button>
    );
}

interface ArchiveRoomNote {
    id: string;
    titleKey: string;
    bodyKey: string;
    rewardItem?: string;
}

export function ArchiveRoomScreen({
    campaignSessionKey,
    levelId,
    translationPrefix,
    notes,
    nextLevel = 'NEXT',
}: {
    campaignSessionKey: string;
    levelId: string;
    translationPrefix: string;
    notes: ArchiveRoomNote[];
    nextLevel?: string | number;
}) {
    const { t } = useTranslation();
    const { session, recordRoomInteraction } = useGameSession();
    const [activeNote, setActiveNote] = useState<ArchiveRoomNote | null>(null);
    const roomSessionKey = `${campaignSessionKey}:${levelId}`;
    const viewedNotes = useMemo(() => new Set(session.roomInteractions[roomSessionKey] ?? []), [roomSessionKey, session.roomInteractions]);
    const allViewed = notes.every((note) => viewedNotes.has(note.id));

    const openNote = (note: ArchiveRoomNote) => {
        audio.playClick();
        recordRoomInteraction(roomSessionKey, note.id);
        if (note.rewardItem && !session.inventoryItems.includes(note.rewardItem)) {
            gameEvents.publish('ITEM_FOUND', note.rewardItem);
            audio.playItemFound();
        }
        setActiveNote(note);
    };

    return (
        <ArchivePuzzleFrame
            subtitle={t(`${translationPrefix}.subtitle`)}
            title={t(`${translationPrefix}.title`)}
            story={t(`${translationPrefix}.body`)}
            feedback={t(`${translationPrefix}.objective`)}
        >
            <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <section className="rounded-[1.75rem] border border-amber-700/30 bg-[#1d140d]/88 p-5 shadow-xl">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {notes.map((note) => {
                            const viewed = viewedNotes.has(note.id);
                            return (
                                <button
                                    key={note.id}
                                    onClick={() => openNote(note)}
                                    className={`rounded-[1.5rem] border p-4 text-left transition-colors ${viewed
                                        ? 'border-emerald-500/35 bg-emerald-500/10'
                                        : 'border-amber-600/30 bg-black/20 hover:border-amber-400/40 hover:bg-amber-500/8'}`}
                                >
                                    <div className="flex items-center gap-3 text-amber-100">
                                        <div className={`rounded-xl border p-2 ${viewed ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/30 bg-amber-500/10'}`}>
                                            <ScrollText size={16} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-stone-400">{viewed ? t(`${translationPrefix}.reviewed`) : t(`${translationPrefix}.new`)}</div>
                                            <div className="mt-1 text-sm font-medium text-stone-100">{t(note.titleKey)}</div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <aside className="flex flex-col gap-4 rounded-[1.75rem] border border-stone-700 bg-black/20 p-5">
                    <ArchiveStatCard label={t(`${translationPrefix}.evidenceCount`)} value={`${viewedNotes.size}/${notes.length}`} />
                    <div className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4 text-sm leading-relaxed text-stone-300">
                        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200">{t(`${translationPrefix}.instructionTitle`)}</div>
                        <p className="mt-2">{t(`${translationPrefix}.instruction`)}</p>
                    </div>
                    <ArchiveButton
                        label={t(`${translationPrefix}.continue`)}
                        onClick={() => {
                            audio.playSuccess();
                            gameEvents.publish('PUZZLE_SOLVED', { nextLevel });
                        }}
                        disabled={!allViewed}
                    />
                </aside>
            </div>

            <AnimatePresence>
                {activeNote && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm"
                        onClick={() => setActiveNote(null)}
                    >
                        <motion.div
                            initial={{ y: 20, scale: 0.98 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: 20, scale: 0.98 }}
                            onClick={(event) => event.stopPropagation()}
                            className="w-full max-w-3xl rounded-[1.75rem] border border-amber-700/35 bg-[#1f150d]/96 shadow-2xl"
                        >
                            <div className="flex items-start justify-between gap-4 border-b border-stone-800 px-6 py-5">
                                <div>
                                    <div className="flex items-center gap-2 text-amber-200">
                                        <FileText size={16} />
                                        <span className="text-[10px] font-mono uppercase tracking-[0.18em]">{t(`${translationPrefix}.evidenceLabel`)}</span>
                                    </div>
                                    <h3 className="mt-2 text-2xl font-semibold text-stone-50">{t(activeNote.titleKey)}</h3>
                                </div>
                                <button
                                    onClick={() => setActiveNote(null)}
                                    className="rounded-xl border border-stone-700 bg-black/20 p-2 text-stone-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="px-6 py-6">
                                <div className="rounded-2xl border border-amber-700/25 bg-black/20 p-5 font-serif text-[15px] leading-8 text-stone-200 whitespace-pre-line">
                                    {t(activeNote.bodyKey)}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </ArchivePuzzleFrame>
    );
}