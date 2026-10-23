import type { AnalyticsSnapshot } from '../../services/explorer-ui/HarnessAnalyticsService';

export type Props = { summary: AnalyticsSnapshot['summary']; loops: AnalyticsSnapshot['loops'] };
