import type { TrackedProcess } from '../../src/utils/processDescendants';

export interface FixtureProcess extends TrackedProcess {
	parent: number;
	group: number;
	ageSeconds: number;
	command: string;
}
