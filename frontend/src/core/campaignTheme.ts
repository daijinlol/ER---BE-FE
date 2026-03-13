import { registry } from '../features/puzzles/registry';
import type { CampaignThemeConfig } from '../features/puzzles/types';

export const defaultCampaignTheme: CampaignThemeConfig = {
    primary: '#64748b',
    secondary: '#cbd5e1',
    surface: '#172033',
};

export function getCampaignTheme(campaignId?: string): CampaignThemeConfig {
    if (!campaignId) {
        return defaultCampaignTheme;
    }

    return registry.campaigns[campaignId]?.theme ?? defaultCampaignTheme;
}

export function withAlpha(hexColor: string, alpha: number) {
    const normalized = hexColor.replace('#', '');
    const safeHex = normalized.length === 3
        ? normalized.split('').map((value) => `${value}${value}`).join('')
        : normalized;

    const red = Number.parseInt(safeHex.slice(0, 2), 16);
    const green = Number.parseInt(safeHex.slice(2, 4), 16);
    const blue = Number.parseInt(safeHex.slice(4, 6), 16);

    if ([red, green, blue].some((value) => Number.isNaN(value))) {
        return `rgba(100,116,139,${alpha})`;
    }

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}