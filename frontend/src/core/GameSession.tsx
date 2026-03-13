import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { GAME_SESSION_STORAGE_KEY } from './gameConstants';
import { deleteSessionSnapshot, persistSessionSnapshot } from './sessionApi';

export type CampaignSessionStatus = 'active' | 'failed' | 'completed';

export interface CampaignSessionSnapshot {
    campaignId: string;
    sessionId: string;
    levelIndex: number;
    inventoryItems: string[];
    timeLeftSeconds: number;
    notes: string;
    roomInteractions: Record<string, string[]>;
    decisionOutcomes: Record<string, string>;
    status: CampaignSessionStatus;
    updatedAt: string;
}

export type CampaignSessionPatch = Partial<Pick<CampaignSessionSnapshot,
    'levelIndex'
    | 'inventoryItems'
    | 'timeLeftSeconds'
    | 'notes'
    | 'roomInteractions'
    | 'decisionOutcomes'
    | 'status'
>>;

type CampaignSessionMap = Record<string, CampaignSessionSnapshot>;

interface GameSessionContextValue {
    session: CampaignSessionSnapshot;
    setLevelIndex: (levelIndex: number) => void;
    addInventoryItem: (item: string) => void;
    setTimeLeftSeconds: (timeLeftSeconds: number) => void;
    setNotes: (notes: string) => void;
    recordRoomInteraction: (roomId: string, hotspotId: string) => void;
    recordDecisionOutcome: (decisionKey: string, outcomeId: string) => void;
    markStatus: (status: CampaignSessionStatus) => void;
    patchSession: (patch: CampaignSessionPatch) => void;
    clearPersistedSession: () => void;
}

const GameSessionContext = createContext<GameSessionContextValue | null>(null);

function canUseStorage() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeSessionSnapshot(snapshot: CampaignSessionSnapshot) {
    return {
        ...snapshot,
        decisionOutcomes: snapshot.decisionOutcomes ?? {},
    };
}

export function loadStoredSessions(): CampaignSessionMap {
    if (!canUseStorage()) {
        return {};
    }

    try {
        const raw = window.localStorage.getItem(GAME_SESSION_STORAGE_KEY);
        if (!raw) {
            return {};
        }

        const parsed = JSON.parse(raw) as CampaignSessionMap;
        if (!parsed || typeof parsed !== 'object') {
            return {};
        }

        return Object.fromEntries(
            Object.entries(parsed).map(([campaignId, snapshot]) => [campaignId, normalizeSessionSnapshot(snapshot)])
        );
    } catch {
        return {};
    }
}

function saveStoredSessions(sessions: CampaignSessionMap) {
    if (!canUseStorage()) {
        return;
    }

    window.localStorage.setItem(GAME_SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

export function cacheStoredSession(snapshot: CampaignSessionSnapshot) {
    const sessions = loadStoredSessions();
    sessions[snapshot.campaignId] = snapshot;
    saveStoredSessions(sessions);
}

export function cacheStoredSessionTimeLeft(campaignId: string, sessionId: string, timeLeftSeconds: number) {
    const sessions = loadStoredSessions();
    const snapshot = sessions[campaignId];
    if (!snapshot || snapshot.sessionId !== sessionId) {
        return;
    }

    sessions[campaignId] = {
        ...snapshot,
        timeLeftSeconds,
        updatedAt: new Date().toISOString(),
    };
    saveStoredSessions(sessions);
}

export function getStoredSession(campaignId: string) {
    return loadStoredSessions()[campaignId] ?? null;
}

export function clearStoredSession(campaignId: string) {
    const sessions = loadStoredSessions();
    if (!sessions[campaignId]) {
        return;
    }

    delete sessions[campaignId];
    saveStoredSessions(sessions);
}

function createFreshSession(campaignId: string, initialTimeSeconds: number): CampaignSessionSnapshot {
    return {
        campaignId,
        sessionId: `${campaignId}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        levelIndex: 0,
        inventoryItems: [],
        timeLeftSeconds: initialTimeSeconds,
        notes: '',
        roomInteractions: {},
        decisionOutcomes: {},
        status: 'active',
        updatedAt: new Date().toISOString(),
    };
}

interface GameSessionProviderProps {
    campaignId: string;
    initialTimeSeconds: number;
    initialSnapshot?: CampaignSessionSnapshot | null;
    children: React.ReactNode;
}

export function GameSessionProvider({ campaignId, initialTimeSeconds, initialSnapshot, children }: GameSessionProviderProps) {
    const [session, setSession] = useState<CampaignSessionSnapshot>(() => {
        if (initialSnapshot && initialSnapshot.campaignId === campaignId) {
            return {
                ...normalizeSessionSnapshot(initialSnapshot),
                status: 'active',
            };
        }

        return createFreshSession(campaignId, initialTimeSeconds);
    });

    useEffect(() => {
        const nextSnapshot = {
            ...session,
            updatedAt: new Date().toISOString(),
        };
        cacheStoredSession(nextSnapshot);

        const persistHandle = window.setTimeout(() => {
            void persistSessionSnapshot(nextSnapshot).catch((error) => {
                console.error('Failed to persist session snapshot:', error);
            });
        }, 150);

        return () => window.clearTimeout(persistHandle);
    }, [campaignId, session]);

    const value = useMemo<GameSessionContextValue>(() => ({
        session,
        setLevelIndex: (levelIndex) => setSession((prev) => ({ ...prev, levelIndex })),
        addInventoryItem: (item) => setSession((prev) => ({
            ...prev,
            inventoryItems: prev.inventoryItems.includes(item) ? prev.inventoryItems : [...prev.inventoryItems, item],
        })),
        setTimeLeftSeconds: (timeLeftSeconds) => setSession((prev) => ({ ...prev, timeLeftSeconds })),
        setNotes: (notes) => setSession((prev) => ({ ...prev, notes })),
        recordRoomInteraction: (roomId, hotspotId) => setSession((prev) => {
            const currentRoomHistory = prev.roomInteractions[roomId] ?? [];
            if (currentRoomHistory.includes(hotspotId)) {
                return prev;
            }

            return {
                ...prev,
                roomInteractions: {
                    ...prev.roomInteractions,
                    [roomId]: [...currentRoomHistory, hotspotId],
                },
            };
        }),
        recordDecisionOutcome: (decisionKey, outcomeId) => setSession((prev) => {
            if (prev.decisionOutcomes[decisionKey] === outcomeId) {
                return prev;
            }

            return {
                ...prev,
                decisionOutcomes: {
                    ...prev.decisionOutcomes,
                    [decisionKey]: outcomeId,
                },
            };
        }),
        markStatus: (status) => setSession((prev) => ({ ...prev, status })),
        patchSession: (patch) => setSession((prev) => ({ ...prev, ...patch })),
        clearPersistedSession: () => {
            clearStoredSession(campaignId);
            void deleteSessionSnapshot(campaignId).catch((error) => {
                console.error('Failed to clear persisted session:', error);
            });
        },
    }), [campaignId, session]);

    return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}

export function useGameSession() {
    const context = useContext(GameSessionContext);
    if (!context) {
        throw new Error('useGameSession must be used inside GameSessionProvider.');
    }

    return context;
}
