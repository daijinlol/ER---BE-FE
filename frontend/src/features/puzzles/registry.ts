import rawRegistry from './registry.json';
import type { PuzzleConfig, PuzzleHotspot, PuzzleRegistry } from './types';

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
            if (!Array.isArray(campaign.levels) || !campaign.levels.every(isPuzzleConfig)) {
                throw new Error(`Campaign ${campaignId} has invalid level definitions.`);
            }

            return [campaignId, {
                timeLimitMinutes: typeof campaign.timeLimitMinutes === 'number' ? campaign.timeLimitMinutes : undefined,
                levels: campaign.levels,
            }];
        })
    );

    return { campaigns };
}

export const registry = validateRegistry(rawRegistry);
