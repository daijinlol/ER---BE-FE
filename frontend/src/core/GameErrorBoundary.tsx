import React from 'react';
import i18n from '../i18n';

interface GameErrorBoundaryProps {
    children: React.ReactNode;
    onReset?: () => void;
}

interface GameErrorBoundaryState {
    hasError: boolean;
}

export class GameErrorBoundary extends React.Component<GameErrorBoundaryProps, GameErrorBoundaryState> {
    state: GameErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error('Game shell crashed:', error);
    }

    private handleReset = () => {
        this.setState({ hasError: false });
        this.props.onReset?.();
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <div className="fixed inset-0 bg-red-950/95 text-red-100 flex items-center justify-center p-6 z-[200]">
                <div className="w-full max-w-xl rounded-2xl border border-red-500/50 bg-black/40 p-8 text-center shadow-[0_0_60px_rgba(239,68,68,0.25)]">
                    <h1 className="text-3xl font-mono font-bold uppercase tracking-widest text-red-300">{i18n.t('errorBoundary.title')}</h1>
                    <p className="mt-4 text-sm leading-relaxed text-slate-200">
                        {i18n.t('errorBoundary.body')}
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="mt-6 rounded-lg border border-red-400/60 bg-red-600 px-6 py-3 font-mono text-sm font-bold tracking-wider text-white transition-colors hover:bg-red-500"
                    >
                        {i18n.t('errorBoundary.reset')}
                    </button>
                </div>
            </div>
        );
    }
}
