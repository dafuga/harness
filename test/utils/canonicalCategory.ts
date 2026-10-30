import { expect } from 'vitest';
import { indexFiles, memoryTree, unitOf } from '../support/memoryTree';
import { unitMetadata } from '../../src/services/explorer-ui/revision-detail-service/unitMetadata';
import { revisionRegistry } from '../../src/utils/revision-registry/revisionRegistry';
import { measureWorkload } from '../support/measureWorkload';

/** Current forwards retain their addresses; historical grouping uses its own source declarations. */
export async function assertCanonicalCategory(): Promise<void> {
	const before = 'src/utils/accounts-access/identity.ts';
	const after = 'src/utils/development-tooling/identity.ts';
	const body = 'export function identity(path: string): string { return path; }';
	const original = unitOf(
		await indexFiles({ [before]: body }),
		'function.accounts-access-identity'
	);
	const taxonomy = JSON.stringify({
		schemaVersion: 1,
		groups: [
			{ id: 'accounts-access', title: 'Accounts', terms: [] },
			{ id: 'development-tooling', title: 'Development tooling', terms: [] }
		]
	});
	const moved = { ...original, owns: { ...original.owns, source: [before, after] } };
	const current = revisionRegistry([moved], []).units;
	await measureWorkload(
		'function.unit-metadata',
		'canonical-and-historical-module-categories',
		() =>
			unitMetadata(
				memoryTree({
					[before]: "export { identity } from '../development-tooling/identity';",
					[after]: body,
					'harness.groups.json': taxonomy
				}),
				current
			)
	);
	expect(current[0].id).toBe(original.id);
	expect(current[0].group).toEqual({ id: 'development-tooling', title: 'Development tooling' });
	const historical = revisionRegistry([original], []).units;
	await unitMetadata(memoryTree({ [before]: body, 'harness.groups.json': taxonomy }), historical);
	expect(historical[0].group).toEqual({ id: 'accounts-access', title: 'Accounts' });
	await unitMetadata(
		memoryTree({ [before]: body, [after]: body, 'harness.groups.json': taxonomy }),
		current
	);
	expect(current[0].group, 'two actual declaration domains remain ambiguous').toBeUndefined();
}
