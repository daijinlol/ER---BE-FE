import { useState } from 'react';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

export interface ValidationResponse {
    success: boolean;
    unlocks: string[];
    message: string;
}

interface ValidationErrorResponse {
    detail?: string | { message?: string };
}

export function usePuzzleValidation(campaignId: string, levelId: string) {
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validate = async (data: Record<string, any>): Promise<ValidationResponse> => {
        setIsChecking(true);
        setError(null);
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10000);

        try {
            const res = await fetch(`${API_BASE_URL}/api/puzzles/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    campaignId,
                    levelId,
                    data
                })
            });
            const json = await res.json() as ValidationResponse | ValidationErrorResponse;
            window.clearTimeout(timeout);
            setIsChecking(false);

            if (!res.ok) {
                const errorResponse = json as ValidationErrorResponse;
                const message = 'message' in json && typeof json.message === 'string'
                    ? json.message
                    : typeof errorResponse.detail === 'string'
                        ? errorResponse.detail
                        : errorResponse.detail?.message || `Validation request failed (${res.status}).`;
                setError(message);
                return { success: false, unlocks: [], message };
            }

            const validationResult = json as ValidationResponse;
            if (!validationResult.success && validationResult.message) {
                setError(validationResult.message);
            }
            return validationResult;
        } catch (err) {
            window.clearTimeout(timeout);
            console.error('Validation API Error:', err);
            const message = err instanceof DOMException && err.name === 'AbortError'
                ? 'Connection to Core Server timed out.'
                : 'Connection to Core Server failed.';
            setError(message);
            setIsChecking(false);
            return { success: false, unlocks: [], message };
        }
    };

    return { validate, isChecking, error };
}
