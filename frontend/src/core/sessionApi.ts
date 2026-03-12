import { fetchJson, getApiErrorMessage } from './api';
import type { CampaignSessionSnapshot } from './GameSession';

export async function listPersistedSessions(): Promise<Record<string, CampaignSessionSnapshot>> {
    const { response, data } = await fetchJson<Record<string, CampaignSessionSnapshot>>('/api/sessions');
    if (!response.ok || !data || typeof data !== 'object') {
        throw new Error(getApiErrorMessage(data, 'Failed to load stored sessions.'));
    }

    return data;
}

export async function restoreSessionSnapshot(campaignId: string): Promise<CampaignSessionSnapshot | null> {
    const { response, data } = await fetchJson<CampaignSessionSnapshot | { detail?: unknown }>(`/api/sessions/${campaignId}`);
    if (response.status === 404) {
        return null;
    }

    if (!response.ok || !data || typeof data !== 'object' || !('campaignId' in data)) {
        throw new Error(getApiErrorMessage(data, `Failed to restore the ${campaignId} session.`));
    }

    return data as CampaignSessionSnapshot;
}

export async function persistSessionSnapshot(snapshot: CampaignSessionSnapshot): Promise<void> {
    const { response, data } = await fetchJson(`/api/sessions/${snapshot.campaignId}`, {
        method: 'PUT',
        body: JSON.stringify(snapshot),
    });

    if (!response.ok) {
        throw new Error(getApiErrorMessage(data, `Failed to persist the ${snapshot.campaignId} session.`));
    }
}

export async function updateSessionTimer(campaignId: string, sessionId: string, timeLeftSeconds: number): Promise<void> {
    const { response, data } = await fetchJson(`/api/sessions/${campaignId}/timer`, {
        method: 'PATCH',
        body: JSON.stringify({ sessionId, timeLeftSeconds }),
    });

    if (!response.ok && response.status !== 404 && response.status !== 409) {
        throw new Error(getApiErrorMessage(data, `Failed to update the ${campaignId} timer.`));
    }
}

export async function deleteSessionSnapshot(campaignId: string): Promise<void> {
    const { response, data } = await fetchJson(`/api/sessions/${campaignId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(getApiErrorMessage(data, `Failed to clear the ${campaignId} session.`));
    }
}