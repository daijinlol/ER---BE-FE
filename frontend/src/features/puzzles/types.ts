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

export interface CampaignThemeConfig {
    primary: string;
    secondary: string;
    surface: string;
}

export interface CampaignDebugProgressPreset {
    inventoryItems: string[];
    roomId?: string;
    roomInteractions?: string[];
}

export interface CampaignDebriefBranchConfig {
    interactionKey: string;
    defaultPath: string;
}

export interface CampaignDecisionRouteConfig {
    defaultOutcome?: string;
    routes: Record<string, string | number>;
}

export interface CampaignDebriefConfig {
    routeStages: string[];
    branch?: CampaignDebriefBranchConfig;
    pathDecisionLevelId?: string;
    defaultPath?: string;
    resultDecisionLevelId?: string;
    defaultResult?: string;
}

export interface CampaignConfig {
    timeLimitMinutes?: number;
    theme: CampaignThemeConfig;
    debugProgressPresets?: Record<string, CampaignDebugProgressPreset>;
    decisionRoutes?: Record<string, CampaignDecisionRouteConfig>;
    debrief?: CampaignDebriefConfig;
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