import { expect, test } from 'vitest';
import { componentManifestSchema } from '../../../src/core/unitTypes';
import { revisionRegistry } from '../../../src/utils/revisionRegistry';
import { moduleRelationships } from '../../../src/services/git-source-history/module-data-service/moduleRelationships';
function declared(id: string, kind: string, source: string, dependencies: string[] = []) {
	return componentManifestSchema.parse({
		schemaVersion: 1,
		id,
		kind,
		title: id,
		responsibility: 'A source-bound graph fixture.',
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: [source], symbols: [] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		dependencies: dependencies.map((unit) => ({ unit, via: 'import', origin: 'derived' })),
		runtime: { kind: 'module', entry: source, targets: [{ kind: 'module', entry: source }] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	});
}
test('committed relationships include transitive APIs, route layouts and cycles without rewriting raw edges', () => {
	const manifests = [
		declared('page.orders', 'page', 'src/routes/orders/+page.svelte', ['component.list']),
		declared('component.list', 'component', 'src/components/List.svelte', ['service.orders']),
		declared('service.orders', 'service', 'src/services/OrdersService.ts', [
			'endpoint.orders',
			'component.list'
		]),
		declared('layout.root', 'layout', 'src/routes/+layout.svelte', ['endpoint.session']),
		declared('endpoint.orders', 'endpoint', 'src/routes/api/orders/+server.ts'),
		declared('endpoint.session', 'endpoint', 'src/routes/api/session/+server.ts')
	];
	manifests[2].dependencies.push({ unit: 'endpoint.orders', via: 'contract', origin: 'declared' });
	const registry = revisionRegistry(manifests, []),
		before = JSON.stringify(registry);
	const projected = moduleRelationships(registry);
	expect(projected['page.orders'].apis).toEqual(['endpoint.session', 'endpoint.orders']);
	expect(projected['page.orders'].layouts).toEqual(['layout.root']);
	expect(projected['component.list'].apis).toEqual(['endpoint.orders']);
	expect(projected['endpoint.orders'].pages).toEqual(['page.orders']);
	expect(JSON.stringify(registry)).toBe(before);
	expect(
		registry.graph.edges.filter(
			(edge) => edge.from === 'unit:service.orders' && edge.to === 'unit:endpoint.orders'
		)
	).toHaveLength(2);
});
