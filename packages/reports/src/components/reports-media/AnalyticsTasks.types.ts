import type { AnalyticsSnapshot } from '../../services/explorer-ui/HarnessAnalyticsService';

export type Jev = AnalyticsSnapshot['jev'];

export type Task = Jev['response']['tasks'][number];
