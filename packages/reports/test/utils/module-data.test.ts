import { expect, test } from 'vitest';
import type {
	ModuleRelationships,
	ModuleValidation
} from '../../../../src/services/git-source-history/ModuleDataService.types';
import { explorerRelations } from '../../src/utils/explorerRelations';
import { harnessClient } from '../../src/utils/explorer-ui/harnessClient';
import { revision, unit } from '../explorerFixture';

const empty = {
	pages: [],
	layouts: [],
	components: [],
	functions: [],
	configs: [],
	services: [],
	types: [],
	apis: [],
	models: [],
	usedBy: [],
	support: []
};
function stored() {
	const head = revision(
		[
			unit('page.orders', 'page', {
				owns: { source: ['src/routes/orders/+page.svelte'], symbols: [] },
				dependencies: [{ unit: 'endpoint.orders', via: 'http' }]
			}),
			unit('endpoint.orders', 'endpoint')
		],
		[],
		[]
	);
	return Object.assign(head, {
		moduleData: {
			required: true,
			committed: true,
			commit: head.commit,
			digest: 'a'.repeat(64),
			issues: [],
			modules: head.registry.units.map((unit) => ({
				id: unit.id,
				kind: unit.kind,
				category: null,
				issues: []
			})) as ModuleValidation[],
			relationships: { 'page.orders': { ...empty }, 'endpoint.orders': { ...empty } } as Record<
				string,
				ModuleRelationships
			>
		}
	});
}
test('relationship readers use committed empty results without searching the source graph', () => {
	const head = stored();
	expect(explorerRelations(head, 'page.orders').apis).toEqual([]);
});
test('required missing relationships fail instead of silently recomputing them', () => {
	const head = stored();
	delete head.moduleData.relationships['endpoint.orders'];
	expect(() => explorerRelations(head, 'endpoint.orders')).toThrow(
		'Missing committed relationships'
	);
});
test('the app refuses incomplete committed metadata and exposes the exact module and field', async () => {
	const head = stored();
	head.moduleData.modules = head.moduleData.modules.map((module) =>
		module.id === 'page.orders'
			? {
					...module,
					issues: [
						{ field: 'contract.inputs', message: 'Missing inputs', repair: 'Commit the contract' }
					]
				}
			: module
	);
	const client = harnessClient('/fixture', respond(head));
	await expect(client.revision(head.commit)).rejects.toThrow('page.orders: contract.inputs');
});
test('the app refuses required uncommitted metadata while leaving legacy data readable', async () => {
	const head = stored();
	const incomplete = { ...head, moduleData: { ...head.moduleData, committed: false } };
	await expect(
		harnessClient('/incomplete', respond(incomplete)).revision(head.commit)
	).rejects.toThrow('Missing committed module data');
	const legacy = revision([], [], []);
	await expect(harnessClient('/legacy', respond(legacy)).revision(legacy.commit)).resolves.toEqual(
		legacy
	);
});

function respond(data: unknown): typeof fetch {
	return Object.assign(async () => new Response(JSON.stringify(data)), {
		preconnect() {}
	}) as typeof fetch;
}

test('an incomplete report is reloaded after a committed repair rather than cached forever', async () => {
	const head = stored();
	let committed = false;
	const fetcher = Object.assign(
		async () =>
			new Response(JSON.stringify({ ...head, moduleData: { ...head.moduleData, committed } })),
		{ preconnect() {} }
	) as typeof fetch;
	const client = harnessClient('/repair', fetcher);
	await expect(client.revision(head.commit)).rejects.toThrow('Missing committed module data');
	committed = true;
	await expect(client.revision(head.commit)).resolves.toMatchObject({ commit: head.commit });
});

test('the app rejects a re-sealed snapshot that omits a module report', async () => {
	const head = stored();
	head.moduleData.modules = [];
	await expect(harnessClient('/omitted', respond(head)).revision(head.commit)).rejects.toThrow(
		'missing validation report'
	);
});
