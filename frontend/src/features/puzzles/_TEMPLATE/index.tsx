import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { audio } from '../../../core/AudioEngine';
import { gameEvents } from '../../../core/EventBus';
import { usePuzzleValidation } from '../../../hooks/usePuzzleValidation';
import type { PuzzleComponentProps } from '../types';

export default function PuzzleTemplate({ campaignId, levelId, config }: PuzzleComponentProps) {
    const { t } = useTranslation();
    const { validate, isChecking, error } = usePuzzleValidation(campaignId, levelId);
    const [isSolved, setIsSolved] = useState(false);

    const handleValidate = async () => {
        audio.playClick();
        const result = await validate({ example: true, configId: config.id });
        if (!result.success) {
            audio.playDeny();
            return;
        }

        setIsSolved(true);
        result.unlocks.forEach((item) => gameEvents.publish('ITEM_FOUND', item));
        gameEvents.publish('PUZZLE_SOLVED', { nextLevel: 'NEXT' });
    };

    return (
        <div className="w-full h-full p-6 bg-slate-950 text-slate-100 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                    <h2 className="text-lg font-mono font-bold uppercase tracking-widest">{config.id}</h2>
                    <p className="text-sm text-slate-400">Replace this module with your puzzle-specific UI.</p>
                </div>
                <button
                    onClick={() => gameEvents.publish('PUZZLE_CLOSED')}
                    className="rounded border border-slate-700 p-2 text-slate-400 transition-colors hover:border-red-400 hover:text-red-300"
                    title="Close Interface"
                >
                    <X size={18} />
                </button>
            </div>

            <motion.div layout className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
                <p className="text-sm text-slate-300">
                    Use the shared `PuzzleComponentProps`, publish `ITEM_FOUND` and `PUZZLE_SOLVED` through the typed event bus, and keep room/inventory/time state inside the shared campaign session.
                </p>
                {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
                {isSolved && <p className="mt-3 text-sm text-emerald-300">{t('gameContainer.campaignComplete', { defaultValue: 'Puzzle solved.' })}</p>}
                <button
                    onClick={handleValidate}
                    disabled={isChecking || isSolved}
                    className="mt-4 rounded-lg border border-brand-500/50 bg-brand-500/10 px-4 py-2 font-mono text-sm font-bold uppercase tracking-wider text-brand-100 transition-colors hover:bg-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isChecking ? 'Validating...' : 'Validate Template'}
                </button>
            </motion.div>
        </div>
    );
}