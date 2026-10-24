import type { HarnessRevision, HarnessUnit } from '../src/models/Harness.types';
import { commits, ids } from './entityUnits';

export const apiIds = {
	orders: 'app.endpoint.orders',
	unused: 'app.endpoint.status',
	refunds: 'app.endpoint.refunds'
};

function api(id: string, route: string, methods: string[]): HarnessUnit {
	return {
		id,
		kind: 'endpoint',
		status: 'active',
		title: route,
		responsibility: `Serves ${route} requests.`,
		owns: { source: [`src/routes${route}/+server.ts`], symbols: methods },
		dependencies: [],
		scenarios: [],
		contract: {
			inputs: [{ name: 'request', type: 'RequestEvent' }],
			outputs: methods.map((name) => ({ name, type: 'Response' })),
			errors: []
		},
		runtime: {
			kind: 'module',
			targets: [{ kind: 'module', entry: `src/routes${route}/+server.ts` }]
		},
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
		version: 'v1'
	};
}

export function withApis(detail: HarnessRevision): HarnessRevision {
	const current = detail.commit === commits.tip;
	const calls =
		detail.commit === commits.first ? [] : [apiIds.orders, ...(current ? [apiIds.refunds] : [])];
	const units = detail.registry.units.map((unit) =>
		unit.id === ids.store
			? {
					...unit,
					dependencies: [...unit.dependencies, ...calls.map((id) => ({ unit: id, via: 'http' }))]
				}
			: unit
	);
	units.push(api(apiIds.orders, '/api/orders', current ? ['GET', 'POST'] : ['GET']));
	units.push(api(apiIds.unused, '/api/status', ['GET']));
	if (current) units.push(api(apiIds.refunds, '/api/refunds', ['POST']));
	return { ...detail, registry: { ...detail.registry, units } };
}
