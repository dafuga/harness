export const growthMetrics = ['source-bytes', 'complexity', 'dependencies'] as const;

export function signed(delta: number | undefined): string {
	if (!delta) return '';
	return delta > 0 ? `+${delta}` : String(delta);
}

export {
	harnessGrowth,
	unitTimings
} from '../../components/explorer-ui/harness-growth/harnessGrowth';

export type { GrowthMetric, GrowthRow } from './harnessGrowth.types';
