// @harness-uid u_bg2otlxz64
import type { ExplorerEntity, ExplorerLocation } from '../../../models/explorer-ui/Explorer.types';
import { entityLens } from '../../../utils/explorer-ui/entityLens';
/** @pure The same entity's tests at a recorded commit, retaining the canonical branch context. */
export function testLocation(
	route: ExplorerLocation,
	entity: Pick<ExplorerEntity, 'id' | 'category'>,
	commit: string
): ExplorerLocation {
	return entityLens(route, { commit, category: entity.category, entity: entity.id, tab: 'tests' });
}
