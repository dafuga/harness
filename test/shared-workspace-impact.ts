import type { ImpactSide } from '../src/core/development-tooling/impactTypes';
import type { SourceIndex } from '../src/services/development-tooling/source-index-service/SourceIndexService';
import { SourceGraphService } from '../src/services/SourceGraphService';
import type { LoadedUnits } from '../src/workflows/development-tooling/load-units/loadUnits';

/** One tree as the impact analysis reads it, with the registry as it is stored. */
export function workspaceImpactSide(loaded: LoadedUnits, index: SourceIndex): ImpactSide {
	return {
		revision: 'working-tree',
		config: loaded.config,
		entries: [...index.files.values()].map(({ path, hash }) => ({ path, hash })),
		manifests: loaded.stored,
		scenarios: loaded.scenarios,
		graph: new SourceGraphService().build(index, loaded.stored, loaded.scenarios)
	};
}
