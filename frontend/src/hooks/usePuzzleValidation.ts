import { useCallback, useState } from 'react';
import { fetchJson, getApiErrorMessage } from '../core/api';

export interface ValidationResponse {
    success: boolean;
    unlocks: string[];
    message: string;
}

interface ValidationErrorResponse {
    detail?: string | { message?: string };
}

export type PuzzlePayload = Record<string, unknown>;

export async function requestPuzzleProgress<T>(campaignId: string, levelId: string, data: PuzzlePayload) {
    const { response, data: json } = await fetchJson<T | ValidationErrorResponse>('/api/puzzles/progress', {
        method: 'POST',
        body: JSON.stringify({
            campaignId,
            levelId,
            data,
        }),
    });

    if (!response.ok) {
        throw new Error(getApiErrorMessage(json, `Puzzle progress request failed (${response.status}).`));
    }

    return json as T;
}

export async function requestPuzzleClue<T>(campaignId: string, levelId: string, data: PuzzlePayload) {
    const { response, data: json } = await fetchJson<T | ValidationErrorResponse>('/api/puzzles/clue', {
        method: 'POST',
        body: JSON.stringify({
            campaignId,
            levelId,
            data,
        }),
    });

    if (!response.ok) {
        throw new Error(getApiErrorMessage(json, `Puzzle clue request failed (${response.status}).`));
    }

    return json as T;
}

export function usePuzzleValidation(campaignId: string, levelId: string) {
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validate = useCallback(async (data: PuzzlePayload): Promise<ValidationResponse> => {
        setIsChecking(true);
        setError(null);
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10000);

        try {
            const { response, data: json } = await fetchJson<ValidationResponse | ValidationErrorResponse>('/api/puzzles/validate', {
                method: 'POST',
                signal: controller.signal,
                body: JSON.stringify({
                    campaignId,
                    levelId,
                    data,
                }),
            });

            if (!response.ok) {
                const message = getApiErrorMessage(json, `Validation request failed (${response.status}).`);
                setError(message);
                return { success: false, unlocks: [], message };
            }

            const validationResult = json as ValidationResponse;
            if (!validationResult.success && validationResult.message) {
                setError(validationResult.message);
            }
            return validationResult;
        } catch (err) {
            console.error('Validation API Error:', err);
            const message = err instanceof DOMException && err.name === 'AbortError'
                ? 'Connection to Core Server timed out.'
                : 'Connection to Core Server failed.';
            setError(message);
            return { success: false, unlocks: [], message };
        } finally {
            window.clearTimeout(timeout);
            setIsChecking(false);
        }
    }, [campaignId, levelId]);

    return { validate, isChecking, error };
}
