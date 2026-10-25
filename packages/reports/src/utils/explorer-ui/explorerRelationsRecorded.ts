import type { ModuleRelationships } from '../../../../../src/services/git-source-history/ModuleDataService.types';
import type { Entity } from './explorerRelations.types';
import type { HarnessRevision } from '../../models/explorer-ui/Harness.types';
import type { ExplorerRelations } from '../../models/explorer-ui/Explorer.types';
import { explorerRole } from './explorerCategory';
import { explorerName } from './explorerName';

export function explorerRelationsRecorded(
	head: HarnessRevision,
	id: string,
	entity: Entity
): ExplorerRelations | undefined {
	const recorded: ModuleRelationships | undefined = head.moduleData?.relationships[id];
	if (!recorded) {
		if (head.moduleData?.required)
			throw new Error(`Missing committed relationships for ${id}; run harness validate --write.`);
		return undefined;
	}
	const units = new Map(head.registry.units.map((unit) => [unit.id, unit]));
	return Object.fromEntries(
		Object.entries(recorded).map(([key, ids]) => [
			key,
			ids.flatMap((id: string) => {
				const unit = units.get(id);
				if (!unit) return [];
				if (key === 'support')
					return [{ id: unit.id, role: explorerRole(unit), name: explorerName(unit), unit }];
				const found = entity(unit);
				return found ? [found] : [];
			})
		])
	) as unknown as ExplorerRelations;
}
