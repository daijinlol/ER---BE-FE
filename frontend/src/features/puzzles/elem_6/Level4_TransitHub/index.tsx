import { Fragment, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Database, HelpCircle, Lock, ScanLine, Unlock, Vault, WandSparkles, X } from 'lucide-react';
import { audio } from '../../../../core/AudioEngine';
import { gameEvents } from '../../../../core/EventBus';
import { useGameSession } from '../../../../core/GameSession';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../../core/gameConstants';
import { usePuzzleValidation } from '../../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../../types';

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
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [placements, setPlacements] = useState<Record<string, string | null>>(() => createEmptyPlacements());
    const [drawerUnlocked, setDrawerUnlocked] = useState(false);
    const [feedbackKey, setFeedbackKey] = useState<string>('level4.awaitingRebuild');
    const [isSolved, setIsSolved] = useState(false);
    const [isManualDecryptOpen, setIsManualDecryptOpen] = useState(false);
    const [manualAnswer, setManualAnswer] = useState('');
    const [manualFeedbackKey, setManualFeedbackKey] = useState<string | null>(null);
    const [activeInfoPanel, setActiveInfoPanel] = useState<'hint' | 'rules'>('hint');

    const hasDecryptor = session.inventoryItems.includes('usb_decryptor');
    const visibleCards = useMemo(
        () => CARDS.filter((card) => !card.locked || drawerUnlocked),
        [drawerUnlocked],
    );
    const selectedCard = CARDS.find((card) => card.id === selectedCardId) ?? null;

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
        <div className="relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-slate-950 p-3 text-slate-100 xl:p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.09)_0%,rgba(2,6,23,1)_58%)]" />

            <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-3 xl:gap-4">
                <div className="relative shrink-0 overflow-hidden rounded-2xl border border-amber-500/20 bg-black/45 p-3 shadow-2xl backdrop-blur-md xl:p-4">
                    <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 text-amber-300">
                                <Database size={18} />
                                <div className="text-xs font-mono uppercase tracking-[0.24em]">{t('level4.subtitle')}</div>
                            </div>
                            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white xl:mt-3 xl:text-3xl">{t('level4.title')}</h2>
                            <p className="mt-2 max-w-4xl border-l-2 border-amber-400 pl-3 text-sm leading-relaxed text-amber-100 xl:mt-3">{t(feedbackKey)}</p>
                        </div>
                        <button
                            onClick={() => {
                                audio.playClick();
                                gameEvents.publish('PUZZLE_CLOSED');
                            }}
                            className="rounded border border-transparent p-1 text-slate-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
                            title={t('common.closeInterface')}
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(19rem,0.82fr)]">
                    <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto rounded-[1.75rem] border border-slate-700 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.1),rgba(2,6,23,1)_64%)] p-4 shadow-xl custom-scrollbar xl:gap-4 xl:p-5 xl:pr-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <StatusCard label={t('level4.completeRows')} value={`${completeRows}/${ROW_COUNT}`} accent="amber" />
                            <StatusCard label={t('level4.decryptorStatus')} value={hasDecryptor ? t('level4.online') : t('level4.offline')} accent={hasDecryptor ? 'emerald' : 'slate'} />
                            <StatusCard label={t('level4.cardBank')} value={`${visibleCards.length}`} accent="slate" />
                        </div>

                        <div className="rounded-3xl border border-slate-800 bg-slate-950/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] xl:p-4">
                            <div className="hidden 2xl:block">
                                <div className="grid grid-cols-[0.9fr_repeat(4,minmax(0,1fr))] gap-2 items-center">
                                    <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">{t('level4.recordId')}</div>
                                    {CATEGORIES.map((category) => (
                                        <div key={category} className="text-center text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">{t(`level4.categories.${category}`)}</div>
                                    ))}

                                    {Array.from({ length: ROW_COUNT }, (_, rowIndex) => (
                                        <Fragment key={`row-${rowIndex}`}>
                                            <div className="rounded-xl border border-slate-700 bg-slate-950/82 px-3 py-3 text-[11px] font-mono uppercase tracking-[0.16em] text-slate-200">
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
                                                        className={`min-h-[4.25rem] rounded-xl border px-3 py-2.5 text-left text-sm transition-colors xl:min-h-[4.75rem] xl:py-3 ${card
                                                            ? 'border-amber-400/50 bg-amber-950/18 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.08)]'
                                                            : 'border-slate-700 bg-slate-950/72 text-slate-500 hover:border-slate-500'}`}
                                                    >
                                                        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">{t(`level4.categories.${category}`)}</div>
                                                        <div className="mt-1.5 leading-tight xl:mt-2">{card ? t(`level4.values.${category}.${card.value}`) : t('level4.emptySlot')}</div>
                                                    </button>
                                                );
                                            })}
                                        </Fragment>
                                    ))}
                                </div>
                            </div>

                            <div className="grid gap-3 2xl:hidden">
                                {Array.from({ length: ROW_COUNT }, (_, rowIndex) => {
                                    const rowComplete = CATEGORIES.every((category) => Boolean(placements[getSlotKey(rowIndex, category)]));

                                    return (
                                        <div key={`stacked-row-${rowIndex}`} className="rounded-2xl border border-slate-800 bg-slate-950/82 p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-400">
                                                    {t('level4.recordLabel', { index: rowIndex + 1 })}
                                                </div>
                                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${rowComplete ? 'border-amber-400/40 bg-amber-500/10 text-amber-200' : 'border-slate-700 bg-slate-900/80 text-slate-500'}`}>
                                                    {rowComplete ? t('level4.online') : t('level4.incomplete')}
                                                </span>
                                            </div>

                                            <div className="mt-3 grid grid-cols-2 gap-2">
                                                {CATEGORIES.map((category) => {
                                                    const slotKey = getSlotKey(rowIndex, category);
                                                    const cardId = placements[slotKey];
                                                    const card = CARDS.find((entry) => entry.id === cardId);

                                                    return (
                                                        <button
                                                            key={`${rowIndex}-${category}`}
                                                            onClick={() => handleSlotClick(rowIndex, category)}
                                                            className={`min-h-[4.1rem] rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${card
                                                                ? 'border-amber-400/50 bg-amber-950/18 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.08)]'
                                                                : 'border-slate-700 bg-slate-950/72 text-slate-500 hover:border-slate-500'}`}
                                                        >
                                                            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">{t(`level4.categories.${category}`)}</div>
                                                            <div className="mt-1.5 leading-tight">{card ? t(`level4.values.${category}.${card.value}`) : t('level4.emptySlot')}</div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                            {Array.from({ length: ROW_COUNT }, (_, rowIndex) => {
                                const rowComplete = CATEGORIES.every((category) => Boolean(placements[getSlotKey(rowIndex, category)]));
                                return (
                                    <div key={`route-${rowIndex}`} className="rounded-2xl border border-slate-700 bg-slate-950/78 p-3">
                                        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">{t('level4.routeLane', { index: rowIndex + 1 })}</div>
                                        <div className="mt-3 flex items-center gap-2">
                                            {Array.from({ length: 4 }, (_, segmentIndex) => (
                                                <div key={segmentIndex} className={`h-3 flex-1 rounded-full ${rowComplete ? 'bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.45)]' : 'bg-slate-800'}`} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto rounded-[1.75rem] border border-slate-700 bg-black/40 p-4 shadow-xl custom-scrollbar xl:gap-4 xl:p-5 xl:pr-3">
                        <div className="rounded-2xl border border-slate-700 bg-slate-950/82 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-xs font-mono uppercase tracking-[0.2em] text-amber-300">{t('level4.drawerTitle')}</div>
                                    <div className="mt-1 text-xs text-slate-500">{t('level4.drawerSubtitle')}</div>
                                </div>
                                {drawerUnlocked ? <Unlock size={16} className="text-amber-300" /> : <Lock size={16} className="text-slate-600" />}
                            </div>
                            <div className="mt-4 flex flex-col gap-2">
                                <button
                                    onClick={handleUnlockDrawer}
                                    disabled={drawerUnlocked || !hasDecryptor}
                                    className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
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
                                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-slate-200 transition-colors hover:border-amber-400/40 hover:text-amber-100"
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            <WandSparkles size={14} />
                                            <span>{t('level4.manualDecrypt.open')}</span>
                                        </div>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-700 bg-slate-950/82 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-amber-300">
                                    {activeInfoPanel === 'hint' ? <HelpCircle size={15} /> : <ScanLine size={15} />}
                                    <div className="text-xs font-mono uppercase tracking-[0.2em]">
                                        {activeInfoPanel === 'hint' ? t('level4.hintTitle') : t('level4.auditRules')}
                                    </div>
                                </div>
                                <div className="flex rounded-xl border border-slate-700 bg-slate-900/80 p-1">
                                    <button
                                        onClick={() => setActiveInfoPanel('hint')}
                                        className={`rounded-lg px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors ${activeInfoPanel === 'hint' ? 'bg-amber-500/15 text-amber-100' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        {t('level4.hintTitle')}
                                    </button>
                                    <button
                                        onClick={() => setActiveInfoPanel('rules')}
                                        className={`rounded-lg px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors ${activeInfoPanel === 'rules' ? 'bg-amber-500/15 text-amber-100' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        {t('level4.auditRules')}
                                    </button>
                                </div>
                            </div>

                            {activeInfoPanel === 'hint' ? (
                                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">{t('level4.hint')}</p>
                            ) : (
                                <>
                                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{t('level4.statusHint')}</p>
                                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
                                        {Array.from({ length: 7 }, (_, index) => (
                                            <li key={index}>{t(`level4.rules.${index + 1}`)}</li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col gap-3 md:grid md:grid-cols-[1.05fr_0.95fr] md:flex-none">
                            <div className="rounded-2xl border border-slate-700 bg-slate-950/82 p-4">
                                <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">{t('level4.selectedFragmentTitle')}</div>
                                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-4">
                                    {selectedCard ? (
                                        <>
                                            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-300">{t(`level4.categories.${selectedCard.category}`)}</div>
                                            <div className="mt-2 text-base text-slate-100">{t(`level4.values.${selectedCard.category}.${selectedCard.value}`)}</div>
                                        </>
                                    ) : (
                                        <div className="text-sm leading-relaxed text-slate-500">{t('level4.selectedFragmentHint')}</div>
                                    )}
                                </div>
                            </div>

                            <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 md:justify-end">
                                <button
                                    onClick={handleReset}
                                    className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-xs uppercase tracking-[0.22em] text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
                                >
                                    {t('level4.reset')}
                                </button>
                                <button
                                    onClick={handleValidate}
                                    disabled={isChecking || isSolved}
                                    className="rounded-2xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isChecking ? t('level4.validating') : t('level4.validate')}
                                </button>
                            </div>
                        </div>

                        <div className="flex min-h-[16rem] flex-1 flex-col rounded-2xl border border-slate-700 bg-slate-950/82 p-4 xl:min-h-[18rem]">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">{t('level4.cardBank')}</div>
                                <div className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                                    {visibleCards.length} fragments
                                </div>
                            </div>
                            <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto pr-1 custom-scrollbar xl:grid-cols-3">
                                {visibleCards.map((card) => {
                                    const isUsed = usedCardIds.has(card.id);
                                    const isSelected = selectedCardId === card.id;
                                    return (
                                        <button
                                            key={card.id}
                                            onClick={() => !isUsed && handleCardSelect(card.id)}
                                            disabled={isUsed}
                                            className={`min-h-[4rem] rounded-xl border px-3 py-2.5 text-left transition-colors xl:min-h-[4.6rem] xl:py-3 ${isSelected
                                                ? 'border-amber-400/70 bg-amber-500/15 text-amber-100'
                                                : 'border-slate-700 bg-slate-900/80 text-slate-200'} ${isUsed ? 'cursor-not-allowed opacity-35' : 'hover:border-amber-400/40 hover:bg-slate-900'}`}
                                        >
                                            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">{t(`level4.categories.${card.category}`)}</div>
                                            <div className="mt-1.5 text-sm leading-tight xl:mt-2">{t(`level4.values.${card.category}.${card.value}`)}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {(error || isSolved) && (
                            <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm leading-relaxed text-slate-300">
                                {error ?? t('level4.archiveRestored')}
                            </div>
                        )}
                    </section>
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

function StatusCard({ label, value, accent }: { label: string; value: string; accent: 'amber' | 'emerald' | 'slate' }) {
    const accentClasses = accent === 'amber'
        ? 'border-amber-400/20 bg-amber-500/8 text-amber-300'
        : accent === 'emerald'
            ? 'border-emerald-400/20 bg-emerald-500/8 text-emerald-300'
            : 'border-slate-700 bg-slate-950/72 text-slate-300';

    return (
        <div className={`rounded-2xl border px-4 py-3 ${accentClasses}`}>
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
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