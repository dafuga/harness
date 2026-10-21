import type { ChangedFile } from '../../core/development-tooling/impactTypes';
import type { UncertainNode } from '../../core/development-tooling/sourceTypes';

export interface ImpactSeeds {
	changed: ChangedFile[];
	/** Graph node ids the kernel starts from. */
	seeds: string[];
	/** Units touched directly: they own a changed file or their manifest changed. */
	direct: Set<string>;
	/** Changes that cannot be bounded and therefore select everything. */
	expansions: UncertainNode[];
}

export { impactSeeds } from '../../services/reports-media/impact-service/impactSeeds';
