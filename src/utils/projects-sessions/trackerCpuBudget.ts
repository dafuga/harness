// @harness-uid u_gyjtguqwrp
const budgetNode = 'harbor-mbp-2';
export const trackerHomeProject = 'harbor';
/** Recommended per-command worker ceiling for non-Harbor work on MB2. */
export const trackerBudgetCores = 4;

export function trackerBudgetNode(node: string): boolean {
	return node === budgetNode;
}

/** The cores this work must share on this computer, or undefined when it has no budget. */
export function trackerCpuBudget(
	node: string,
	project: string | null | undefined
): number | undefined {
	return trackerBudgetNode(node) && project?.trim().toLowerCase() !== trackerHomeProject
		? trackerBudgetCores
		: undefined;
}

export function trackerCpuBudgetEnvironment(cores: number): string[] {
	return [
		'TRACKER_CPU_BUDGET',
		'CMAKE_BUILD_PARALLEL_LEVEL',
		'CARGO_BUILD_JOBS',
		'OMP_NUM_THREADS',
		'RAYON_NUM_THREADS',
		'GOMAXPROCS'
	]
		.map((name) => `${name}=${cores}`)
		.concat(`MAKEFLAGS=-j${cores}`);
}

export function trackerCpuBudgetRule(cores: number): string {
	return `**CPU budget:** on this computer run tests and builds with at most ${cores} workers (for example \`--maxWorkers=${cores}\`, \`--workers=${cores}\`, \`-j${cores}\`), one test suite at a time, and no parallel browser runs.`;
}
