export interface ReuseModule {
	reuseFindings(filename: string, source: string): Array<{ kind: string; index: number }>;
	reuseAllowlistGaps(current: Record<string, number>, ceiling: Record<string, number>): string[];
}
