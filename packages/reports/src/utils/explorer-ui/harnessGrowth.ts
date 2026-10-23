export const growthMetrics = ['source-bytes', 'complexity', 'dependencies'] as const;

export type GrowthMetric = (typeof growthMetrics)[number];

export interface GrowthRow {
	commit: string;
	subject: string;
	committedAt: string;
	values: Record<GrowthMetric, number | undefined>;
	/** Why a metric has no value at this commit, or what its value leaves out. */
	notes: Partial<Record<GrowthMetric, string>>;
	/** Change since the previous measured point; undefined for the first point or no value. */
	deltas: Record<GrowthMetric, number | undefined>;
	changed: boolean;
}

export function signed(delta: number | undefined): string {
	if (!delta) return '';
	return delta > 0 ? `+${delta}` : String(delta);
}

export {
	harnessGrowth,
	unitTimings
} from '../../components/explorer-ui/harness-growth/harnessGrowth';
