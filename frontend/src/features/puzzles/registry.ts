import rawRegistry from './registry.json';
import type {
    CampaignDebriefConfig,
    CampaignDecisionRouteConfig,
    CampaignDebugProgressPreset,
    CampaignThemeConfig,
    PuzzleConfig,
    PuzzleHotspot,
    PuzzleRegistry,
} from './types';

function isHotspot(value: unknown): value is PuzzleHotspot {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const hotspot = value as Record<string, unknown>;
    return typeof hotspot.id === 'string'
        && typeof hotspot.x === 'number'
        && typeof hotspot.y === 'number'
        && typeof hotspot.action === 'string'
        && typeof hotspot.label === 'string'
        && (hotspot.rewardItem === undefined || typeof hotspot.rewardItem === 'string');
}

function isPuzzleConfig(value: unknown): value is PuzzleConfig {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const config = value as Record<string, unknown>;
    return typeof config.id === 'string'
        && typeof config.componentPath === 'string'
        && (config.backgroundUrl === undefined || typeof config.backgroundUrl === 'string')
        && (config.hotspots === undefined || (Array.isArray(config.hotspots) && config.hotspots.every(isHotspot)));
}

function isThemeConfig(value: unknown): value is CampaignThemeConfig {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const theme = value as Record<string, unknown>;
    return typeof theme.primary === 'string'
        && typeof theme.secondary === 'string'
        && typeof theme.surface === 'string';
}

function isDebugProgressPreset(value: unknown): value is CampaignDebugProgressPreset {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const preset = value as Record<string, unknown>;
    return Array.isArray(preset.inventoryItems)
        && preset.inventoryItems.every((item) => typeof item === 'string')
        && (preset.roomId === undefined || typeof preset.roomId === 'string')
        && (preset.roomInteractions === undefined || (Array.isArray(preset.roomInteractions) && preset.roomInteractions.every((item) => typeof item === 'string')));
}

function isDebriefConfig(value: unknown): value is CampaignDebriefConfig {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const config = value as Record<string, unknown>;
    const branch = config.branch;
    const branchIsValid = branch === undefined || (
        typeof branch === 'object'
        && branch !== null
        && typeof (branch as Record<string, unknown>).interactionKey === 'string'
        && typeof (branch as Record<string, unknown>).defaultPath === 'string'
    );

    return Array.isArray(config.routeStages)
        && config.routeStages.every((stage) => typeof stage === 'string')
        && (config.pathDecisionLevelId === undefined || typeof config.pathDecisionLevelId === 'string')
        && (config.defaultPath === undefined || typeof config.defaultPath === 'string')
        && (config.resultDecisionLevelId === undefined || typeof config.resultDecisionLevelId === 'string')
        && (config.defaultResult === undefined || typeof config.defaultResult === 'string')
        && branchIsValid;
}

function isDecisionRouteConfig(value: unknown): value is CampaignDecisionRouteConfig {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const config = value as Record<string, unknown>;
    if (config.defaultOutcome !== undefined && typeof config.defaultOutcome !== 'string') {
        return false;
    }

    if (!config.routes || typeof config.routes !== 'object') {
        return false;
    }

    return Object.values(config.routes as Record<string, unknown>).every((routeTarget) => typeof routeTarget === 'string' || typeof routeTarget === 'number');
}

function validateRegistry(value: unknown): PuzzleRegistry {
    if (!value || typeof value !== 'object') {
        throw new Error('Puzzle registry is missing or malformed.');
    }

    const input = value as Record<string, unknown>;
    const campaignsValue = input.campaigns;
    if (!campaignsValue || typeof campaignsValue !== 'object') {
        throw new Error('Puzzle registry must define campaigns.');
    }

    const campaigns = Object.fromEntries(
        Object.entries(campaignsValue as Record<string, unknown>).map(([campaignId, campaignValue]) => {
            if (!campaignValue || typeof campaignValue !== 'object') {
                throw new Error(`Campaign ${campaignId} is malformed.`);
            }

            const campaign = campaignValue as Record<string, unknown>;
            if (!isThemeConfig(campaign.theme)) {
                throw new Error(`Campaign ${campaignId} is missing required theme metadata.`);
            }

            if (!Array.isArray(campaign.levels) || !campaign.levels.every(isPuzzleConfig)) {
                throw new Error(`Campaign ${campaignId} has invalid level definitions.`);
            }

            const debugProgressPresets = campaign.debugProgressPresets;
            const decisionRoutes = campaign.decisionRoutes;
            if (
                debugProgressPresets !== undefined
                && (
                    typeof debugProgressPresets !== 'object'
                    || debugProgressPresets === null
                    || !Object.values(debugProgressPresets as Record<string, unknown>).every(isDebugProgressPreset)
                )
            ) {
                throw new Error(`Campaign ${campaignId} has invalid debug progress presets.`);
            }

            if (
                decisionRoutes !== undefined
                && (
                    typeof decisionRoutes !== 'object'
                    || decisionRoutes === null
                    || !Object.values(decisionRoutes as Record<string, unknown>).every(isDecisionRouteConfig)
                )
            ) {
                throw new Error(`Campaign ${campaignId} has invalid decision route metadata.`);
            }

            if (campaign.debrief !== undefined && !isDebriefConfig(campaign.debrief)) {
                throw new Error(`Campaign ${campaignId} has invalid debrief metadata.`);
            }

            return [campaignId, {
                timeLimitMinutes: typeof campaign.timeLimitMinutes === 'number' ? campaign.timeLimitMinutes : undefined,
                theme: campaign.theme,
                debugProgressPresets: debugProgressPresets as Record<string, CampaignDebugProgressPreset> | undefined,
                decisionRoutes: decisionRoutes as Record<string, CampaignDecisionRouteConfig> | undefined,
                debrief: campaign.debrief as CampaignDebriefConfig | undefined,
                levels: campaign.levels,
            }];
        })
    );

    return { campaigns };
}

export const registry = validateRegistry(rawRegistry);
