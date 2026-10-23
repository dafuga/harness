import type { ExplorerEntity } from '../../models/explorer-ui/Explorer.types';
import type { HarnessRevision } from '../../models/explorer-ui/Harness.types';
import { explorerChange, explorerEntity } from './explorerEntities';
import { explorerRole } from './explorerCategory';
import { explorerVerdict } from './explorer-verdict/explorerVerdict';
import { explorerKindCategory } from '../../../../../src/utils/explorerRoute';
export type { UsageGroup, EntityUsage, SupportRow } from './entityUsage.types';

/** Public collection admission never controls which active runtime owners may use a helper. */
export function usageOwners(entities: ExplorerEntity[], revision?: HarnessRevision) {
	const owners = new Map(entities.map((entity) => [entity.id, entity]));
	if (!revision) return owners;
	for (const unit of revision.registry.units) {
		if (unit.status !== 'active') continue;
		const entity = explorerEntity(revision, unit, true);
		owners.set(
			unit.id,
			entity ?? {
				id: unit.id,
				category: explorerKindCategory(unit.kind) ?? 'functions',
				role: explorerRole(unit),
				name: unit.title,
				purpose: unit.responsibility,
				unit,
				verdict: explorerVerdict(unit, revision),
				change: explorerChange(revision, unit.id),
				appRoute: null,
				caller: { symbol: '', sourceOnly: true }
			}
		);
	}
	return owners;
}

/** Named procedural callers count separately; component and class consumers remain owner units. */
export function helperConsumers(
	helper: NonNullable<ExplorerEntity['unit']['helpers']>[number],
	owners: Map<string, ExplorerEntity>,
	ownerId: string
): ExplorerEntity[] {
	const found = new Map<string, ExplorerEntity>();
	for (const consumer of helper.consumers ?? []) {
		const owner = owners.get(consumer.unit);
		if (!owner || owner.change === 'removed' || owner.unit.status !== 'active') continue;
		const entity = namedCaller(owner, consumer.symbol);
		if (consumer.unit === ownerId && (!entity.caller?.symbol || entity.name === helper.name))
			continue;
		found.set(usageIdentity(entity), entity);
	}
	return [...found.values()];
}

function namedCaller(owner: ExplorerEntity, symbol?: string): ExplorerEntity {
	const kind = explorerKindCategory(owner.unit.kind);
	if (!symbol || (kind !== 'functions' && kind !== null)) return owner;
	return {
		...owner,
		name: symbol,
		caller: {
			symbol,
			sourceOnly:
				Boolean(owner.caller?.sourceOnly) ||
				!owner.unit.helpers?.some((item) => item.name === symbol)
		}
	};
}

export function usageIdentity(entity: ExplorerEntity): string {
	return entity.caller ? `${entity.id}#${entity.caller.symbol}` : entity.id;
}

export {
	entityUsage,
	usageGroups
} from '../../components/explorer-ui/entity-relations/entityUsage';
