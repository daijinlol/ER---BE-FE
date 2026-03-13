import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../../core/AudioEngine';
import { gameEvents } from '../../../../core/EventBus';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../../core/gameConstants';
import { usePuzzleValidation } from '../../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../../types';
import { ArchiveButton, ArchivePuzzleFrame, ArchiveStatCard } from '../shared';

type Field = 'document' | 'archive' | 'seal' | 'verdict';

interface CardDefinition {
    id: string;
    field: Field;
    value: string;
}

interface EvidenceRow {
    document: string;
    archive: string;
    seal: string;
    verdict: string;
}

type CheckStatus = 'ok' | 'warning' | 'pending';

const FIELDS: Field[] = ['document', 'archive', 'seal', 'verdict'];

const CARDS: CardDefinition[] = [
    { id: 'document_charter', field: 'document', value: 'charter_page' },
    { id: 'document_registry', field: 'document', value: 'registry_copy' },
    { id: 'document_witness', field: 'document', value: 'witness_roll' },
    { id: 'archive_north', field: 'archive', value: 'north_shelf' },
    { id: 'archive_inner', field: 'archive', value: 'inner_vault' },
    { id: 'archive_clerk', field: 'archive', value: 'clerk_drawer' },
    { id: 'seal_valid', field: 'seal', value: 'wax_valid' },
    { id: 'seal_broken', field: 'seal', value: 'wax_broken' },
    { id: 'seal_counter', field: 'seal', value: 'countermark' },
    { id: 'verdict_authentic', field: 'verdict', value: 'authentic' },
    { id: 'verdict_disputed', field: 'verdict', value: 'disputed' },
    { id: 'verdict_supporting', field: 'verdict', value: 'supporting' },
];

const DOCUMENT_TO_ARCHIVE: Record<string, string> = {
    charter_page: 'inner_vault',
    registry_copy: 'clerk_drawer',
    witness_roll: 'north_shelf',
};

const DOCUMENT_TO_SEAL: Record<string, string> = {
    charter_page: 'wax_valid',
    registry_copy: 'countermark',
    witness_roll: 'wax_broken',
};

const SEAL_TO_VERDICT: Record<string, string> = {
    wax_valid: 'authentic',
    countermark: 'supporting',
    wax_broken: 'disputed',
};

function emptyPlacements() {
    return Object.fromEntries(Array.from({ length: 3 }, (_, rowIndex) => FIELDS.map((field) => [`${rowIndex}:${field}`, null])).flat()) as Record<string, string | null>;
}

function buildRow(rowIndex: number, placements: Record<string, string | null>) {
    const documentCard = CARDS.find((entry) => entry.id === placements[`${rowIndex}:document`]);
    const archiveCard = CARDS.find((entry) => entry.id === placements[`${rowIndex}:archive`]);
    const sealCard = CARDS.find((entry) => entry.id === placements[`${rowIndex}:seal`]);
    const verdictCard = CARDS.find((entry) => entry.id === placements[`${rowIndex}:verdict`]);

    return {
        document: documentCard?.value ?? '',
        archive: archiveCard?.value ?? '',
        seal: sealCard?.value ?? '',
        verdict: verdictCard?.value ?? '',
    };
}

function getRowChecks(row: EvidenceRow) {
    return [
        {
            id: 'documentArchive',
            labelKey: 'elem7.level6.checks.documentArchive',
            status: getCheckStatus(row.document, row.archive, DOCUMENT_TO_ARCHIVE),
        },
        {
            id: 'documentSeal',
            labelKey: 'elem7.level6.checks.documentSeal',
            status: getCheckStatus(row.document, row.seal, DOCUMENT_TO_SEAL),
        },
        {
            id: 'sealVerdict',
            labelKey: 'elem7.level6.checks.sealVerdict',
            status: getCheckStatus(row.seal, row.verdict, SEAL_TO_VERDICT),
        },
    ];
}

function getCheckStatus(left: string, right: string, sourceMap: Record<string, string>): CheckStatus {
    if (!left || !right) {
        return 'pending';
    }

    return sourceMap[left] === right ? 'ok' : 'warning';
}

export default function Level6FinalReconciliation({ campaignId, levelId }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [placements, setPlacements] = useState<Record<string, string | null>>(emptyPlacements);
    const [feedbackKey, setFeedbackKey] = useState('elem7.level6.feedback.start');
    const [isSolved, setIsSolved] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);

    const usedCardIds = useMemo(() => new Set(Object.values(placements).filter((value): value is string => Boolean(value))), [placements]);
    const completedRows = useMemo(() => Array.from({ length: 3 }, (_, rowIndex) => FIELDS.every((field) => Boolean(placements[`${rowIndex}:${field}`]))).filter(Boolean).length, [placements]);
    const rows = useMemo(() => Array.from({ length: 3 }, (_, rowIndex) => buildRow(rowIndex, placements)), [placements]);
    const rowChecks = useMemo(() => rows.map((row) => getRowChecks(row)), [rows]);
    const consistentRows = useMemo(() => rowChecks.filter((checks) => checks.every((check) => check.status === 'ok')).length, [rowChecks]);

    const handleSlotClick = (rowIndex: number, field: Field) => {
        const slotKey = `${rowIndex}:${field}`;
        const current = placements[slotKey];

        if (!selectedCardId && current) {
            audio.playHover();
            setPlacements((prev) => ({ ...prev, [slotKey]: null }));
            return;
        }

        if (!selectedCardId) {
            audio.playDeny();
            return;
        }

        const card = CARDS.find((entry) => entry.id === selectedCardId);
        if (!card || card.field !== field) {
            audio.playDeny();
            setFeedbackKey('elem7.level6.feedback.fieldMismatch');
            return;
        }

        audio.playClick();
        setPlacements((prev) => ({ ...prev, [slotKey]: selectedCardId }));
        setSelectedCardId(current ?? null);
        setFeedbackKey('elem7.level6.feedback.updated');
    };

    const handleValidate = async () => {
        if (isSolved || isChecking) {
            return;
        }

        const hasIncompleteRow = rows.some((row) => FIELDS.some((field) => !row[field]));
        if (hasIncompleteRow) {
            audio.playDeny();
            setFeedbackKey('elem7.level6.feedback.incomplete');
            return;
        }

        audio.playClick();
        const result = await validate({ rows });
        if (!result.success) {
            audio.playDeny();
            setFailedAttempts((current) => current + 1);
            setFeedbackKey('elem7.level6.feedback.failure');
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            return;
        }

        const outcomeId = failedAttempts === 0 ? 'verified' : 'contested';
        setIsSolved(true);
        setFeedbackKey(outcomeId === 'verified' ? 'elem7.level6.feedback.verified' : 'elem7.level6.feedback.contested');
        audio.playSuccess();
        result.unlocks.forEach((item) => gameEvents.publish('ITEM_FOUND', item));
        window.setTimeout(() => gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT', outcomeId }), 1200);
    };

    return (
        <ArchivePuzzleFrame
            subtitle={t('elem7.level6.subtitle')}
            title={t('elem7.level6.title')}
            story={t('elem7.level6.story')}
            feedback={error ?? t(feedbackKey)}
        >
            <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_22rem]">
                <section className="flex min-h-0 flex-col gap-4 rounded-[1.75rem] border border-amber-700/30 bg-[#1d140d]/88 p-5 shadow-xl">
                    <div className="grid gap-3 md:grid-cols-5">
                        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-stone-400">{t('elem7.level6.evidenceRow')}</div>
                        {FIELDS.map((field) => (
                            <div key={field} className="text-center text-[10px] font-mono uppercase tracking-[0.18em] text-stone-400">{t(`elem7.level6.fields.${field}`)}</div>
                        ))}

                        {Array.from({ length: 3 }, (_, rowIndex) => (
                            <div key={`row-${rowIndex}`} className="contents">
                                <div key={`label-${rowIndex}`} className="rounded-xl border border-stone-700 bg-black/20 px-3 py-3 text-[11px] font-mono uppercase tracking-[0.18em] text-stone-200">{t('elem7.level6.recordLabel', { index: rowIndex + 1 })}</div>
                                {FIELDS.map((field) => {
                                    const card = CARDS.find((entry) => entry.id === placements[`${rowIndex}:${field}`]);
                                    return (
                                        <button
                                            key={`${rowIndex}:${field}`}
                                            onClick={() => handleSlotClick(rowIndex, field)}
                                            className={`min-h-[4.25rem] rounded-xl border px-3 py-2 text-left transition-colors ${card ? 'border-amber-500/40 bg-amber-500/10 text-amber-50' : 'border-stone-700 bg-black/20 text-stone-500 hover:border-stone-500'}`}
                                        >
                                            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-stone-500">{t(`elem7.level6.fields.${field}`)}</div>
                                            <div className="mt-2 text-sm">{card ? t(`elem7.level6.values.${field}.${card.value}`) : t('elem7.level6.emptySlot')}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                        {rowChecks.map((checks, rowIndex) => (
                            <div key={`checks-${rowIndex}`} className="rounded-2xl border border-stone-700 bg-black/20 p-4">
                                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200">{t('elem7.level6.rowAudit', { index: rowIndex + 1 })}</div>
                                <div className="mt-3 space-y-2">
                                    {checks.map((check) => (
                                        <div key={check.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-2 text-xs">
                                            <span className="text-stone-300">{t(check.labelKey)}</span>
                                            <span className={`font-mono uppercase tracking-[0.14em] ${check.status === 'ok' ? 'text-emerald-300' : check.status === 'warning' ? 'text-red-300' : 'text-stone-500'}`}>
                                                {t(`elem7.level6.status.${check.status}`)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-stone-700 bg-black/20 p-4">
                        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200">{t('elem7.level6.cardBank')}</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {CARDS.map((card) => {
                                const selected = selectedCardId === card.id;
                                const used = usedCardIds.has(card.id);
                                return (
                                    <button
                                        key={card.id}
                                        onClick={() => {
                                            if (used && !selected) {
                                                return;
                                            }
                                            audio.playClick();
                                            setSelectedCardId((prev) => prev === card.id ? null : card.id);
                                        }}
                                        disabled={used && !selected}
                                        className={`rounded-xl border px-3 py-3 text-left transition-colors ${selected ? 'border-amber-400/50 bg-amber-500/12 text-amber-50' : used ? 'border-stone-800 bg-black/20 text-stone-500' : 'border-stone-700 bg-stone-950/50 text-stone-200 hover:border-amber-500/30'}`}
                                    >
                                        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-stone-500">{t(`elem7.level6.fields.${card.field}`)}</div>
                                        <div className="mt-2 text-sm">{t(`elem7.level6.values.${card.field}.${card.value}`)}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-3">
                        <SourceTableCard
                            title={t('elem7.level6.sources.documentArchive.title')}
                            description={t('elem7.level6.sources.documentArchive.body')}
                            leftLabel={t('elem7.level6.fields.document')}
                            rightLabel={t('elem7.level6.fields.archive')}
                            rows={Object.entries(DOCUMENT_TO_ARCHIVE).map(([document, archive]) => [t(`elem7.level6.values.document.${document}`), t(`elem7.level6.values.archive.${archive}`)])}
                        />
                        <SourceTableCard
                            title={t('elem7.level6.sources.documentSeal.title')}
                            description={t('elem7.level6.sources.documentSeal.body')}
                            leftLabel={t('elem7.level6.fields.document')}
                            rightLabel={t('elem7.level6.fields.seal')}
                            rows={Object.entries(DOCUMENT_TO_SEAL).map(([document, seal]) => [t(`elem7.level6.values.document.${document}`), t(`elem7.level6.values.seal.${seal}`)])}
                        />
                        <SourceTableCard
                            title={t('elem7.level6.sources.sealVerdict.title')}
                            description={t('elem7.level6.sources.sealVerdict.body')}
                            leftLabel={t('elem7.level6.fields.seal')}
                            rightLabel={t('elem7.level6.fields.verdict')}
                            rows={Object.entries(SEAL_TO_VERDICT).map(([seal, verdict]) => [t(`elem7.level6.values.seal.${seal}`), t(`elem7.level6.values.verdict.${verdict}`)])}
                        />
                    </div>
                </section>

                <aside className="flex flex-col gap-4 rounded-[1.75rem] border border-stone-700 bg-black/20 p-5">
                    <ArchiveStatCard label={t('elem7.level6.completeRows')} value={`${completedRows}/3`} />
                    <ArchiveStatCard label={t('elem7.level6.consistentRows')} value={`${consistentRows}/3`} accent="emerald" />
                    <ArchiveStatCard label={t('elem7.level6.finalState')} value={isSolved ? t('elem7.common.restored') : t('elem7.common.pending')} accent={isSolved ? 'emerald' : 'stone'} />
                    <div className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4 text-sm leading-relaxed text-stone-300">
                        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200">{t('elem7.level6.hintTitle')}</div>
                        <p className="mt-2">{t('elem7.level6.hint')}</p>
                    </div>
                    <ArchiveButton label={t('elem7.level6.validate')} onClick={handleValidate} disabled={isSolved || isChecking} />
                </aside>
            </div>
        </ArchivePuzzleFrame>
    );
}

function SourceTableCard({
    title,
    description,
    leftLabel,
    rightLabel,
    rows,
}: {
    title: string;
    description: string;
    leftLabel: string;
    rightLabel: string;
    rows: Array<[string, string]>;
}) {
    return (
        <div className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200">{title}</div>
            <p className="mt-2 text-sm leading-relaxed text-stone-300">{description}</p>
            <div className="mt-4 rounded-xl border border-stone-800 bg-black/20">
                <div className="grid grid-cols-2 gap-2 border-b border-stone-800 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.14em] text-stone-500">
                    <span>{leftLabel}</span>
                    <span>{rightLabel}</span>
                </div>
                <div className="divide-y divide-stone-800">
                    {rows.map(([left, right]) => (
                        <div key={`${left}-${right}`} className="grid grid-cols-2 gap-2 px-3 py-2 text-sm text-stone-200">
                            <span>{left}</span>
                            <span>{right}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}