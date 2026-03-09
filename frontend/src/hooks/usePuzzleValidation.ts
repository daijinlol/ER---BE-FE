import { useState } from 'react';

export interface ValidationResponse {
    success: boolean;
    unlocks: string[];
    message: string;
}

export function usePuzzleValidation(campaignId: string, levelId: string) {
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validate = async (data: Record<string, any>): Promise<ValidationResponse> => {
        setIsChecking(true);
        setError(null);
        try {
            // Note: the backend URL would normally be determined by env vars, e.g. import.meta.env.VITE_API_URL
            const res = await fetch('http://127.0.0.1:8000/api/puzzles/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaignId,
                    levelId,
                    data
                })
            });
            const json = await res.json();
            setIsChecking(false);
            if (!json.success && json.message) {
                setError(json.message);
            }
            return json;
        } catch (err) {
            console.error('Validation API Error:', err);
            setError('Connection to Core Server failed.');
            setIsChecking(false);
            return { success: false, unlocks: [], message: 'Connection failed.' };
        }
    };

    return { validate, isChecking, error };
}
