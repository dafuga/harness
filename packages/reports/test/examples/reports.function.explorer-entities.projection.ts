import type { explorerEntity } from '../../src/utils/explorer-ui/explorerEntities';

/** The fields that decide an entity's projection, with its verdict in full. */
export const projected = (entity: ReturnType<typeof explorerEntity>) =>
	entity && {
		id: entity.id,
		category: entity.category,
		role: entity.role,
		name: entity.name,
		change: entity.change,
		appRoute: entity.appRoute,
		lastAt: entity.lastAt ?? null,
		verdict: entity.verdict
	};

/** The verdict of a unit at a revision that holds no verification record. */
export const pending = {
	passed: false,
	label: 'Evidence missing',
	reasons: ['No verification record is attached to this commit.']
};
