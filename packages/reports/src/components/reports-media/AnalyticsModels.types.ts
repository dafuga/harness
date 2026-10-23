import type { AnalyticsSnapshot } from '../../services/explorer-ui/HarnessAnalyticsService';

export type Models = AnalyticsSnapshot['models'];

export type Check = Models['firstTryByAuthor'][string]['response'];

export type Usage = { name: string; count: number | null };
