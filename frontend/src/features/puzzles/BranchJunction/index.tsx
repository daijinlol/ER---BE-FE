import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, GitBranch, ScanSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';
import { useGameSession } from '../../../core/GameSession';
import type { PuzzleComponentProps } from '../types';

type PathChoice = 'left' | 'right' | null;

export default function BranchJunction({ config, campaignSessionKey }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { recordRoomInteraction } = useGameSession();
    const [selectedPath, setSelectedPath] = useState<PathChoice>(null);
    const junctionSessionKey = `${campaignSessionKey}:${config.id}`;

    const handleChoose = (path: Exclude<PathChoice, null>) => {
        if (selectedPath) {
            return;
        }

        audio.playSuccess();
        setSelectedPath(path);
        recordRoomInteraction(junctionSessionKey, path);
        window.setTimeout(() => {
            gameEvents.publish('PUZZLE_SOLVED', { nextLevel: path === 'left' ? '5_left' : '5_right' });
        }, 850);
    };

    return (
        <div className="relative h-full w-full overflow-hidden bg-slate-950 text-slate-100">
            {config.backgroundUrl && (
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${config.backgroundUrl})` }}
                />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.18),rgba(2,6,23,0.7)_55%,rgba(2,6,23,0.92))]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.08),transparent_45%)]" />

            <div className="relative z-10 flex h-full flex-col p-5 md:p-8">
                <div className="max-w-3xl rounded-2xl border border-cyan-400/20 bg-slate-950/72 p-5 shadow-[0_0_40px_rgba(8,145,178,0.12)] backdrop-blur-md">
                    <div className="flex items-center gap-3 text-cyan-300">
                        <GitBranch size={18} />
                        <div className="text-xs font-mono uppercase tracking-[0.26em]">{t('branchJunction.kicker')}</div>
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold tracking-[0.04em] text-white md:text-3xl">{t('branchJunction.title')}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">{t('branchJunction.body')}</p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.24em] text-amber-100">
                        <ScanSearch size={14} />
                        <span>{t('branchJunction.prompt')}</span>
                    </div>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 hidden md:block">
                    <div className="absolute left-[8%] top-[58%] h-28 w-28 rounded-full bg-cyan-400/12 blur-3xl" />
                    <div className="absolute right-[8%] top-[58%] h-28 w-28 rounded-full bg-amber-400/12 blur-3xl" />
                </div>

                <div className="relative mt-6 flex-1 min-h-[420px]">
                    <div className="grid gap-4 md:hidden">
                        <ChoiceButton
                            title={t('branchJunction.left.title')}
                            summary={t('branchJunction.left.summary')}
                            detail={t('branchJunction.left.detail')}
                            accentClass="border-cyan-400/45 bg-slate-950/72 hover:border-cyan-300/80 hover:bg-cyan-500/10"
                            icon={<ArrowLeft size={18} />}
                            onClick={() => handleChoose('left')}
                            selected={selectedPath === 'left'}
                            disabled={selectedPath !== null}
                        />
                        <ChoiceButton
                            title={t('branchJunction.right.title')}
                            summary={t('branchJunction.right.summary')}
                            detail={t('branchJunction.right.detail')}
                            accentClass="border-amber-400/45 bg-slate-950/72 hover:border-amber-300/80 hover:bg-amber-500/10"
                            icon={<ArrowRight size={18} />}
                            onClick={() => handleChoose('right')}
                            selected={selectedPath === 'right'}
                            disabled={selectedPath !== null}
                        />
                    </div>

                    <div className="hidden h-full md:block">
                        <div className="absolute left-[4%] top-[48%] w-[34%] max-w-md">
                            <ChoiceButton
                                title={t('branchJunction.left.title')}
                                summary={t('branchJunction.left.summary')}
                                detail={t('branchJunction.left.detail')}
                                accentClass="border-cyan-400/45 bg-slate-950/72 hover:border-cyan-300/80 hover:bg-cyan-500/10"
                                icon={<ArrowLeft size={18} />}
                                onClick={() => handleChoose('left')}
                                selected={selectedPath === 'left'}
                                disabled={selectedPath !== null}
                            />
                        </div>
                        <div className="absolute right-[4%] top-[48%] w-[34%] max-w-md">
                            <ChoiceButton
                                title={t('branchJunction.right.title')}
                                summary={t('branchJunction.right.summary')}
                                detail={t('branchJunction.right.detail')}
                                accentClass="border-amber-400/45 bg-slate-950/72 hover:border-amber-300/80 hover:bg-amber-500/10"
                                icon={<ArrowRight size={18} />}
                                onClick={() => handleChoose('right')}
                                selected={selectedPath === 'right'}
                                disabled={selectedPath !== null}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ChoiceButton({
    title,
    summary,
    detail,
    accentClass,
    icon,
    onClick,
    selected,
    disabled,
}: {
    title: string;
    summary: string;
    detail: string;
    accentClass: string;
    icon: ReactNode;
    onClick: () => void;
    selected: boolean;
    disabled: boolean;
}) {
    return (
        <motion.button
            whileHover={disabled ? undefined : { y: -4 }}
            whileTap={disabled ? undefined : { scale: 0.99 }}
            onClick={onClick}
            disabled={disabled}
            className={`rounded-[1.75rem] border p-5 text-left shadow-[0_20px_70px_rgba(2,6,23,0.35)] backdrop-blur-md transition-all ${accentClass} ${disabled && !selected ? 'opacity-72' : ''}`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-[0.22em] text-slate-200">
                    {icon}
                    <span>{title}</span>
                </div>
                {selected && <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-200">Locked In</span>}
            </div>
            <p className="mt-5 text-xl font-semibold text-white">{summary}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{detail}</p>
        </motion.button>
    );
}