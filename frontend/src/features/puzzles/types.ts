export type PuzzleHotspotAction = 'NEXT_LEVEL' | 'LORE' | 'PUZZLE' | 'DIALOGUE';

export interface PuzzleHotspot {
    id: string;
    x: number;
    y: number;
    action: PuzzleHotspotAction;
    label: string;
    content?: string;
    rewardItem?: string;
    requires?: string[];
}

export interface PuzzleConfig {
    id: string;
    componentPath: string;
    backgroundUrl?: string;
    hotspots?: PuzzleHotspot[];
}

export interface CampaignConfig {
    timeLimitMinutes?: number;
    levels: PuzzleConfig[];
}

export interface PuzzleRegistry {
    campaigns: Record<string, CampaignConfig>;
}

export interface PuzzleComponentProps {
    campaignId: string;
    levelId: string;
    config: PuzzleConfig;
    campaignSessionKey: string;
}