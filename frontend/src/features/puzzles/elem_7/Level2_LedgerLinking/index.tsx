import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../../core/AudioEngine';
import { gameEvents } from '../../../../core/EventBus';
import { PUZZLE_MISTAKE_PENALTY_SECONDS } from '../../../../core/gameConstants';
import { usePuzzleValidation } from '../../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../../types';
import { ArchiveButton, ArchivePuzzleFrame, ArchiveStatCard } from '../shared';

type Field = 'resident' | 'street' | 'parcel' | 'district';

interface CardDefinition {
    id: string;
    field: Field;
    value: string;
}

interface LedgerRow {
    resident: string;
    street: string;
    parcel: string;
    district: string;
}

type CheckStatus = 'ok' | 'warning' | 'pending';

const FIELDS: Field[] = ['resident', 'street', 'parcel', 'district'];

const CARDS: CardDefinition[] = [
    { id: 'resident_eliska', field: 'resident', value: 'eliska' },
    { id: 'resident_jan', field: 'resident', value: 'jan' },
    { id: 'resident_marta', field: 'resident', value: 'marta' },
    { id: 'street_bridge', field: 'street', value: 'bridge' },
    { id: 'street_mill', field: 'street', value: 'mill' },
    { id: 'street_square', field: 'street', value: 'square' },
    { id: 'parcel_a12', field: 'parcel', value: 'A-12' },
    { id: 'parcel_b07', field: 'parcel', value: 'B-07' },
    { id: 'parcel_c19', field: 'parcel', value: 'C-19' },
    { id: 'district_north', field: 'district', value: 'north' },
    { id: 'district_river', field: 'district', value: 'river' },
    { id: 'district_market', field: 'district', value: 'market' },
];

const RESIDENT_TO_STREET: Record<string, string> = {
    eliska: 'bridge',
    jan: 'square',
    marta: 'mill',
};

const STREET_TO_PARCEL: Record<string, string> = {
    bridge: 'A-12',
    square: 'B-07',
    mill: 'C-19',
};

const PARCEL_TO_DISTRICT: Record<string, string> = {
    'A-12': 'north',
    'B-07': 'market',
    'C-19': 'river',
};

function emptyPlacements() {
    return Object.fromEntries(Array.from({ length: 3 }, (_, rowIndex) => FIELDS.map((field) => [`${rowIndex}:${field}`, null])).flat()) as Record<string, string | null>;
}

function buildRow(rowIndex: number, placements: Record<string, string | null>) {
    const residentCard = CARDS.find((entry) => entry.id === placements[`${rowIndex}:resident`]);
    const streetCard = CARDS.find((entry) => entry.id === placements[`${rowIndex}:street`]);
    const parcelCard = CARDS.find((entry) => entry.id === placements[`${rowIndex}:parcel`]);
    const districtCard = CARDS.find((entry) => entry.id === placements[`${rowIndex}:district`]);

    return {
        resident: residentCard?.value ?? '',
        street: streetCard?.value ?? '',
        parcel: parcelCard?.value ?? '',
        district: districtCard?.value ?? '',
    };
}

function getRowChecks(row: LedgerRow) {
    return [
        {
            id: 'residentStreet',
            labelKey: 'elem7.level2.checks.residentStreet',
            status: getCheckStatus(row.resident, row.street, RESIDENT_TO_STREET),
        },
        {
            id: 'streetParcel',
            labelKey: 'elem7.level2.checks.streetParcel',
            status: getCheckStatus(row.street, row.parcel, STREET_TO_PARCEL),
        },
        {
            id: 'parcelDistrict',
            labelKey: 'elem7.level2.checks.parcelDistrict',
            status: getCheckStatus(row.parcel, row.district, PARCEL_TO_DISTRICT),
        },
    ];
}

function getCheckStatus(left: string, right: string, sourceMap: Record<string, string>): CheckStatus {
    if (!left || !right) {
        return 'pending';
    }

    return sourceMap[left] === right ? 'ok' : 'warning';
}

export default function Level2LedgerLinking({ campaignId, levelId }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [placements, setPlacements] = useState<Record<string, string | null>>(emptyPlacements);
    const [feedbackKey, setFeedbackKey] = useState('elem7.level2.feedback.start');
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
            setFeedbackKey('elem7.level2.feedback.fieldMismatch');
            return;
        }

        audio.playClick();
        setPlacements((prev) => ({ ...prev, [slotKey]: selectedCardId }));
        setSelectedCardId(current ?? null);
        setFeedbackKey('elem7.level2.feedback.updated');
    };

    const handleValidate = async () => {
        if (isSolved || isChecking) {
            return;
        }

        const hasIncompleteRow = rows.some((row) => FIELDS.some((field) => !row[field]));
        if (hasIncompleteRow) {
            audio.playDeny();
            setFeedbackKey('elem7.level2.feedback.incomplete');
            return;
        }

        audio.playClick();
        const result = await validate({ rows });

        if (!result.success) {
            audio.playDeny();
            setFailedAttempts((current) => current + 1);
            setFeedbackKey('elem7.level2.feedback.failure');
            gameEvents.publish('TIME_PENALTY', { seconds: PUZZLE_MISTAKE_PENALTY_SECONDS });
            return;
        }

        const outcomeId = failedAttempts === 0 ? 'fast_track' : 'review_track';
        setIsSolved(true);
        setFeedbackKey(outcomeId === 'fast_track' ? 'elem7.level2.feedback.fastTrack' : 'elem7.level2.feedback.reviewTrack');
        audio.playSuccess();
        result.unlocks.forEach((item) => gameEvents.publish('ITEM_FOUND', item));
        window.setTimeout(() => gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT', outcomeId }), 1200);
    };

    return (
        <ArchivePuzzleFrame
            subtitle={t('elem7.level2.subtitle')}
            title={t('elem7.level2.title')}
            story={t('elem7.level2.story')}
            feedback={error ?? t(feedbackKey)}
        >
            <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_22rem]">
                <section className="flex min-h-0 flex-col gap-4 rounded-[1.75rem] border border-amber-700/30 bg-[#1d140d]/88 p-5 shadow-xl">
                    <div className="grid gap-3 md:grid-cols-5">
                        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-stone-400">{t('elem7.level2.record')}</div>
                        {FIELDS.map((field) => (
                            <div key={field} className="text-center text-[10px] font-mono uppercase tracking-[0.18em] text-stone-400">{t(`elem7.level2.fields.${field}`)}</div>
                        ))}

                        {Array.from({ length: 3 }, (_, rowIndex) => (
                            <div key={`row-${rowIndex}`} className="contents">
                                <div key={`label-${rowIndex}`} className="rounded-xl border border-stone-700 bg-black/20 px-3 py-3 text-[11px] font-mono uppercase tracking-[0.18em] text-stone-200">{t('elem7.level2.recordLabel', { index: rowIndex + 1 })}</div>
                                {FIELDS.map((field) => {
                                    const card = CARDS.find((entry) => entry.id === placements[`${rowIndex}:${field}`]);
                                    return (
                                        <button
                                            key={`${rowIndex}:${field}`}
                                            onClick={() => handleSlotClick(rowIndex, field)}
                                            className={`min-h-[4.25rem] rounded-xl border px-3 py-2 text-left transition-colors ${card ? 'border-amber-500/40 bg-amber-500/10 text-amber-50' : 'border-stone-700 bg-black/20 text-stone-500 hover:border-stone-500'}`}
                                        >
                                            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-stone-500">{t(`elem7.level2.fields.${field}`)}</div>
                                            <div className="mt-2 text-sm">{card ? t(`elem7.level2.values.${field}.${String(card.value).replace('-', '_')}`) : t('elem7.level2.emptySlot')}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                        {rowChecks.map((checks, rowIndex) => (
                            <div key={`checks-${rowIndex}`} className="rounded-2xl border border-stone-700 bg-black/20 p-4">
                                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200">{t('elem7.level2.rowAudit', { index: rowIndex + 1 })}</div>
                                <div className="mt-3 space-y-2">
                                    {checks.map((check) => (
                                        <div key={check.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-800 bg-stone-950/60 px-3 py-2 text-xs">
                                            <span className="text-stone-300">{t(check.labelKey)}</span>
                                            <span className={`font-mono uppercase tracking-[0.14em] ${check.status === 'ok' ? 'text-emerald-300' : check.status === 'warning' ? 'text-red-300' : 'text-stone-500'}`}>
                                                {t(`elem7.level2.status.${check.status}`)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-stone-700 bg-black/20 p-4">
                        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200">{t('elem7.level2.cardBank')}</div>
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
                                        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-stone-500">{t(`elem7.level2.fields.${card.field}`)}</div>
                                        <div className="mt-2 text-sm">{t(`elem7.level2.values.${card.field}.${String(card.value).replace('-', '_')}`)}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-3">
                        <SourceTableCard
                            title={t('elem7.level2.sources.residentStreet.title')}
                            description={t('elem7.level2.sources.residentStreet.body')}
                            leftLabel={t('elem7.level2.fields.resident')}
                            rightLabel={t('elem7.level2.fields.street')}
                            rows={Object.entries(RESIDENT_TO_STREET).map(([resident, street]) => [t(`elem7.level2.values.resident.${resident}`), t(`elem7.level2.values.street.${street}`)])}
                        />
                        <SourceTableCard
                            title={t('elem7.level2.sources.streetParcel.title')}
                            description={t('elem7.level2.sources.streetParcel.body')}
                            leftLabel={t('elem7.level2.fields.street')}
                            rightLabel={t('elem7.level2.fields.parcel')}
                            rows={Object.entries(STREET_TO_PARCEL).map(([street, parcel]) => [t(`elem7.level2.values.street.${street}`), t(`elem7.level2.values.parcel.${parcel.replace('-', '_')}`)])}
                        />
                        <SourceTableCard
                            title={t('elem7.level2.sources.parcelDistrict.title')}
                            description={t('elem7.level2.sources.parcelDistrict.body')}
                            leftLabel={t('elem7.level2.fields.parcel')}
                            rightLabel={t('elem7.level2.fields.district')}
                            rows={Object.entries(PARCEL_TO_DISTRICT).map(([parcel, district]) => [t(`elem7.level2.values.parcel.${parcel.replace('-', '_')}`), t(`elem7.level2.values.district.${district}`)])}
                        />
                    </div>
                </section>

                <aside className="flex flex-col gap-4 rounded-[1.75rem] border border-stone-700 bg-black/20 p-5">
                    <ArchiveStatCard label={t('elem7.level2.completeRows')} value={`${completedRows}/3`} />
                    <ArchiveStatCard label={t('elem7.level2.consistentRows')} value={`${consistentRows}/3`} accent="emerald" />
                    <ArchiveStatCard label={t('elem7.level2.selection')} value={selectedCardId ? t('elem7.common.selected') : t('elem7.common.none')} accent="stone" />
                    <div className="rounded-2xl border border-stone-700 bg-stone-950/60 p-4 text-sm leading-relaxed text-stone-300">
                        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-200">{t('elem7.level2.hintTitle')}</div>
                        <p className="mt-2">{t('elem7.level2.hint')}</p>
                    </div>
                    <ArchiveButton label={t('elem7.level2.validate')} onClick={handleValidate} disabled={isSolved || isChecking} />
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