const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = (
    configuredApiUrl
    || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')
).replace(/\/$/, '');

export function resolveApiUrl(path: string) {
    return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export async function fetchJson<T>(path: string, init: RequestInit = {}) {
    const response = await fetch(resolveApiUrl(path), {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
        },
    });

    const hasBody = response.status !== 204;
    const data = hasBody
        ? await response.json().catch(() => null)
        : null;

    return {
        response,
        data: data as T,
    };
}

export function getApiErrorMessage(data: unknown, fallback: string) {
    if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>;
        const message = record.message;
        if (typeof message === 'string') {
            return message;
        }

        const detail = record.detail;
        if (typeof detail === 'string') {
            return detail;
        }

        if (detail && typeof detail === 'object') {
            const detailRecord = detail as Record<string, unknown>;
            if (typeof detailRecord.message === 'string') {
                return detailRecord.message;
            }
        }
    }

    return fallback;
}