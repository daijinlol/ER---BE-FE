import { Fragment, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Database, HelpCircle, Lock, ScanLine, Unlock, Vault, WandSparkles, X } from 'lucide-react';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';
import { useGameSession } from '../../../core/GameSession';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../core/gameConstants';
import { usePuzzleValidation } from '../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../types';

type Category = 'person' | 'sector' | 'time' | 'shuttle';

interface CardDefinition {
    id: string;
    category: Category;
    value: string;
    locked?: boolean;
}

const CATEGORIES: Category[] = ['person', 'sector', 'time', 'shuttle'];

const CARDS: CardDefinition[] = [
    { id: 'person_hana', category: 'person', value: 'hana' },
    { id: 'person_ivo', category: 'person', value: 'ivo' },
    { id: 'person_nera', category: 'person', value: 'nera', locked: true },
    { id: 'sector_a', category: 'sector', value: 'sector_a' },
    { id: 'sector_c', category: 'sector', value: 'sector_c' },
    { id: 'sector_d', category: 'sector', value: 'sector_d' },
    { id: 'time_1910', category: 'time', value: '19:10' },
    { id: 'time_1920', category: 'time', value: '19:20' },
    { id: 'time_1930', category: 'time', value: '19:30' },
    { id: 'shuttle_ventus', category: 'shuttle', value: 'ventus' },
    { id: 'shuttle_atlas', category: 'shuttle', value: 'atlas' },
    { id: 'shuttle_kestrel', category: 'shuttle', value: 'kestrel' },
];

const ROW_COUNT = 3;

export default function Level4TransitHub({ campaignId, levelId }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const { session } = useGameSession();
    const [hintOpen, setHintOpen] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [placements, setPlacements] = useState<Record<string, string | null>>(() => createEmptyPlacements());
    const [drawerUnlocked, setDrawerUnlocked] = useState(false);
    const [feedbackKey, setFeedbackKey] = useState<string>('level4.awaitingRebuild');
    const [isSolved, setIsSolved] = useState(false);
    const [isManualDecryptOpen, setIsManualDecryptOpen] = useState(false);
    const [manualAnswer, setManualAnswer] = useState('');
    const [manualFeedbackKey, setManualFeedbackKey] = useState<string | null>(null);

    const hasDecryptor = session.inventoryItems.includes('usb_decryptor');
    const visibleCards = useMemo(
        () => CARDS.filter((card) => !card.locked || drawerUnlocked),
        [drawerUnlocked],
    );

    const usedCardIds = new Set(Object.values(placements).filter((value): value is string => Boolean(value)));
    const completeRows = useMemo(
        () => Array.from({ length: ROW_COUNT }, (_, rowIndex) => CATEGORIES.every((category) => Boolean(placements[getSlotKey(rowIndex, category)]))).filter(Boolean).length,
        [placements],
    );

    const handleCardSelect = (cardId: string) => {
        audio.playClick();
        setSelectedCardId((prev) => (prev === cardId ? null : cardId));
    };

    const handleSlotClick = (rowIndex: number, category: Category) => {
        const slotKey = getSlotKey(rowIndex, category);
        const currentCardId = placements[slotKey];

        if (!selectedCardId && currentCardId) {
            audio.playHover();
            setPlacements((prev) => ({ ...prev, [slotKey]: null }));
            return;
        }

        if (!selectedCardId) {
            audio.playDeny();
            return;
        }

        const selectedCard = CARDS.find((card) => card.id === selectedCardId);
        if (!selectedCard || selectedCard.category !== category) {
            audio.playDeny();
            setFeedbackKey('level4.slotMismatch');
            return;
        }

        audio.playClick();
        setPlacements((prev) => ({
            ...prev,
            [slotKey]: selectedCardId,
        }));
        setSelectedCardId(currentCardId ?? null);
        setFeedbackKey('level4.recordUpdated');
    };

    const handleUnlockDrawer = () => {
        if (!hasDecryptor) {
            audio.playDeny();
            return;
        }

        audio.playSuccess();
        setDrawerUnlocked(true);
        setFeedbackKey('level4.drawerUnlocked');
    };

    const handleManualDecrypt = () => {
        const normalizedAnswer = manualAnswer.trim().toUpperCase();
        if (!normalizedAnswer) {
            audio.playDeny();
            setManualFeedbackKey('level4.manualDecrypt.empty');
            return;
        }

        if (normalizedAnswer !== 'NERA') {
            audio.playDeny();
            setManualFeedbackKey('level4.manualDecrypt.failure');
            return;
        }

        audio.playSuccess();
        setDrawerUnlocked(true);
        setManualFeedbackKey('level4.manualDecrypt.success');
        setFeedbackKey('level4.manualDrawerUnlocked');
        window.setTimeout(() => {
            setIsManualDecryptOpen(false);
            setManualAnswer('');
            setManualFeedbackKey(null);
        }, 900);
    };

    const handleReset = () => {
        if (isSolved || isChecking) {
            return;
        }

        audio.playHover();
        setPlacements(createEmptyPlacements());
        setSelectedCardId(null);
        setFeedbackKey('level4.awaitingRebuild');
    };

    const handleValidate = async () => {
        if (isSolved || isChecking) {
            return;
        }

        const rows = Array.from({ length: ROW_COUNT }, (_, rowIndex) => buildRow(rowIndex, placements));
        const hasMissingField = rows.some((row) => CATEGORIES.some((category) => !row[category]));
        if (hasMissingField) {
            audio.playDeny();
            setFeedbackKey('level4.incomplete');
            return;
        }

        audio.playClick();
        const result = await validate({ rows });

        if (!result.success) {
            audio.playDeny();
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            setFeedbackKey('level4.failedAudit');
            return;
        }

        audio.playSuccess();
        setIsSolved(true);
        setFeedbackKey('level4.archiveRestored');

        setTimeout(() => {
            result.unlocks.forEach((item) => gameEvents.publish('ITEM_FOUND', item));
            audio.playItemFound();
            setFeedbackKey('level4.storageGranted');
        }, 1400);

        setTimeout(() => {
            gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
        }, 3400);
    };

    return (
        <div className="w-full h-full flex flex-col items-center p-4 bg-slate-950 overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.09)_0%,rgba(2,6,23,1)_58%)] pointer-events-none" />

            <div className="w-full z-10 flex flex-col gap-3 cursor-default flex-1 min-h-0">
                <div className="bg-black/50 border border-amber-500/20 rounded-xl p-4 backdrop-blur-md shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />
                    <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-4">
                            <Database className="text-amber-300" size={20} />
                            <div>
                                <h2 className="text-sm font-mono text-slate-100 uppercase tracking-[0.24em]">{t('level4.title')}</h2>
                                <p className="text-xs font-mono text-slate-500 tracking-wider">{t('level4.subtitle')}</p>
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
                    <p className="font-mono text-xs text-amber-100 border-l-2 border-amber-400 pl-3 leading-relaxed">{t(feedbackKey)}</p>
                </div>

                <button
                    onClick={() => setHintOpen((prev) => !prev)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-950/40 border border-amber-500/20 rounded-lg text-amber-200 text-xs font-mono tracking-wider hover:bg-amber-950/60 transition-colors w-full text-left"
                >
                    <HelpCircle size={14} />
                    <span className="flex-1">{t('level4.hintTitle')}</span>
                    <span>{hintOpen ? '−' : '+'}</span>
                </button>
                {hintOpen && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-950/30 border border-amber-500/20 rounded-lg px-4 py-3 text-amber-100 text-xs font-mono leading-relaxed whitespace-pre-line">
                        {t('level4.hint')}
                    </motion.div>
                )}

                <div className="grid xl:grid-cols-[1.28fr_0.92fr] gap-5 flex-1 min-h-0 overflow-hidden">
                    <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-4 shadow-xl flex flex-col gap-3 min-h-0 overflow-hidden">
                        <div className="grid grid-cols-[0.9fr_repeat(4,minmax(0,1fr))] gap-2 items-center">
                            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">{t('level4.recordId')}</div>
                            {CATEGORIES.map((category) => (
                                <div key={category} className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 text-center">{t(`level4.categories.${category}`)}</div>
                            ))}

                            {Array.from({ length: ROW_COUNT }, (_, rowIndex) => (
                                <Fragment key={`row-${rowIndex}`}>
                                    <div key={`label-${rowIndex}`} className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-3 text-[11px] font-mono uppercase tracking-[0.16em] text-slate-200">
                                        {t('level4.recordLabel', { index: rowIndex + 1 })}
                                    </div>
                                    {CATEGORIES.map((category) => {
                                        const slotKey = getSlotKey(rowIndex, category);
                                        const cardId = placements[slotKey];
                                        const card = CARDS.find((entry) => entry.id === cardId);

                                        return (
                                            <button
                                                key={`${rowIndex}-${category}`}
                                                onClick={() => handleSlotClick(rowIndex, category)}
                                                className={`min-h-16 rounded-xl border px-3 py-3 text-sm transition-colors ${card ? 'border-amber-400/50 bg-amber-950/15 text-amber-100' : 'border-slate-700 bg-slate-950/70 text-slate-500 hover:border-slate-500'}`}
                                            >
                                                {card ? t(`level4.values.${category}.${card.value}`) : t('level4.emptySlot')}
                                            </button>
                                        );
                                    })}
                                </Fragment>
                            ))}
                        </div>

                        <div className="grid gap-2 md:grid-cols-3">
                            {Array.from({ length: ROW_COUNT }, (_, rowIndex) => {
                                const rowComplete = CATEGORIES.every((category) => Boolean(placements[getSlotKey(rowIndex, category)]));
                                return (
                                    <div key={`route-${rowIndex}`} className="rounded-xl border border-slate-700 bg-slate-950/75 p-3">
                                        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">{t('level4.routeLane', { index: rowIndex + 1 })}</div>
                                        <div className="mt-2 flex items-center gap-2">
                                            {Array.from({ length: 4 }, (_, segmentIndex) => (
                                                <div key={segmentIndex} className={`h-3 flex-1 rounded-full ${rowComplete ? 'bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.45)]' : 'bg-slate-800'}`} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-black/45 border border-slate-700 rounded-xl p-4 shadow-xl flex flex-col gap-3 min-h-0 overflow-hidden">
                        <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-xs font-mono uppercase tracking-[0.2em] text-amber-300">{t('level4.drawerTitle')}</div>
                                    <div className="mt-1 text-xs text-slate-500">{t('level4.drawerSubtitle')}</div>
                                </div>
                                {drawerUnlocked ? <Unlock size={16} className="text-amber-300" /> : <Lock size={16} className="text-slate-600" />}
                            </div>
                            <button
                                onClick={handleUnlockDrawer}
                                disabled={drawerUnlocked || !hasDecryptor}
                                className="mt-3 w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <Vault size={14} />
                                    <span>{drawerUnlocked ? t('level4.drawerOpened') : t('level4.unlockDrawer')}</span>
                                </div>
                            </button>
                            {!drawerUnlocked && !hasDecryptor && (
                                <button
                                    onClick={() => {
                                        audio.playClick();
                                        setManualFeedbackKey(null);
                                        setManualAnswer('');
                                        setIsManualDecryptOpen(true);
                                    }}
                                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-slate-200 transition-colors hover:border-amber-400/40 hover:text-amber-100"
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <WandSparkles size={14} />
                                        <span>{t('level4.manualDecrypt.open')}</span>
                                    </div>
                                </button>
                            )}
                        </div>

                        <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-3">
                            <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('level4.cardBank')}</div>
                            <div className="mt-3 grid grid-cols-2 xl:grid-cols-3 gap-2">
                                {visibleCards.map((card) => {
                                    const isUsed = usedCardIds.has(card.id);
                                    const isSelected = selectedCardId === card.id;
                                    return (
                                        <button
                                            key={card.id}
                                            onClick={() => !isUsed && handleCardSelect(card.id)}
                                            disabled={isUsed}
                                            className={`rounded-lg border px-2.5 py-2 text-left transition-colors min-h-[68px] ${isSelected ? 'border-amber-400/70 bg-amber-500/15 text-amber-100' : 'border-slate-700 bg-slate-900/80 text-slate-200'} ${isUsed ? 'opacity-35 cursor-not-allowed' : 'hover:border-amber-400/40'}`}
                                        >
                                            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">{t(`level4.categories.${card.category}`)}</div>
                                            <div className="mt-1 text-[13px] leading-tight">{t(`level4.values.${card.category}.${card.value}`)}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-[1.08fr_0.92fr] gap-3 min-h-0">
                            <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-3">
                                <div className="flex items-center gap-2 text-amber-300 text-xs font-mono uppercase tracking-[0.2em]">
                                    <ScanLine size={14} />
                                    <span>{t('level4.auditRules')}</span>
                                </div>
                                <ul className="mt-2 space-y-1 text-[13px] text-slate-300 leading-snug">
                                    {Array.from({ length: 7 }, (_, index) => (
                                        <li key={index}>{t(`level4.rules.${index + 1}`)}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-1 gap-3 text-xs font-mono uppercase tracking-[0.18em]">
                                    <div className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-slate-400">
                                        <div>{t('level4.completeRows')}</div>
                                        <div className="mt-2 text-lg text-amber-200">{completeRows}/{ROW_COUNT}</div>
                                    </div>
                                    <div className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-slate-400">
                                        <div>{t('level4.decryptorStatus')}</div>
                                        <div className={`mt-2 text-lg ${hasDecryptor ? 'text-emerald-300' : 'text-slate-500'}`}>{hasDecryptor ? t('level4.online') : t('level4.offline')}</div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleReset}
                                        className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 font-mono text-sm uppercase tracking-[0.2em] text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
                                    >
                                        {t('level4.reset')}
                                    </button>
                                    <button
                                        onClick={handleValidate}
                                        disabled={isChecking || isSolved}
                                        className="rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-2.5 font-mono text-sm font-bold uppercase tracking-[0.2em] text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isChecking ? t('level4.validating') : t('level4.validate')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-2.5 text-sm text-slate-300 min-h-12">
                            {error ?? t(isSolved ? 'level4.archiveRestored' : 'level4.statusHint')}
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isManualDecryptOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                        onClick={() => setIsManualDecryptOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                            onClick={(event) => event.stopPropagation()}
                            className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-slate-950/95 p-6 shadow-[0_0_40px_rgba(251,191,36,0.16)]"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-xs font-mono uppercase tracking-[0.24em] text-amber-300">{t('level4.manualDecrypt.title')}</div>
                                    <div className="mt-2 text-sm leading-relaxed text-slate-300">{t('level4.manualDecrypt.body')}</div>
                                </div>
                                <button
                                    onClick={() => setIsManualDecryptOpen(false)}
                                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-400 transition-colors hover:text-slate-100"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-950/15 px-4 py-4">
                                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-amber-200">{t('level4.manualDecrypt.cipherLabel')}</div>
                                <div className="mt-3 text-3xl font-mono tracking-[0.35em] text-amber-100">QHUD</div>
                                <div className="mt-3 text-sm leading-relaxed text-slate-300">{t('level4.manualDecrypt.hint')}</div>
                            </div>

                            <div className="mt-5">
                                <label className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">{t('level4.manualDecrypt.answerLabel')}</label>
                                <input
                                    value={manualAnswer}
                                    onChange={(event) => setManualAnswer(event.target.value.toUpperCase())}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            handleManualDecrypt();
                                        }
                                    }}
                                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-mono uppercase tracking-[0.22em] text-slate-100 outline-none transition-colors focus:border-amber-400/50"
                                    placeholder={t('level4.manualDecrypt.placeholder')}
                                    maxLength={12}
                                />
                            </div>

                            <div className="mt-4 min-h-6 text-sm text-slate-300">
                                {manualFeedbackKey ? t(manualFeedbackKey) : t('level4.manualDecrypt.prompt')}
                            </div>

                            <div className="mt-5 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsManualDecryptOpen(false)}
                                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                                >
                                    {t('level4.manualDecrypt.cancel')}
                                </button>
                                <button
                                    onClick={handleManualDecrypt}
                                    className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.18em] text-amber-100 transition-colors hover:bg-amber-500/20"
                                >
                                    {t('level4.manualDecrypt.submit')}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function createEmptyPlacements() {
    const placements: Record<string, string | null> = {};
    for (let rowIndex = 0; rowIndex < ROW_COUNT; rowIndex += 1) {
        for (const category of CATEGORIES) {
            placements[getSlotKey(rowIndex, category)] = null;
        }
    }
    return placements;
}

function getSlotKey(rowIndex: number, category: Category) {
    return `${rowIndex}:${category}`;
}

function buildRow(rowIndex: number, placements: Record<string, string | null>) {
    return Object.fromEntries(
        CATEGORIES.map((category) => {
            const cardId = placements[getSlotKey(rowIndex, category)];
            const card = CARDS.find((entry) => entry.id === cardId);
            return [category, card?.value ?? ''];
        }),
    ) as Record<Category, string>;
}