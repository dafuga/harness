import { expect, test } from 'vitest';
import { indexFiles } from '../../support/memoryTree';
import { measureWorkload } from '../../support/measureWorkload';
import { defaultUnitsConfig } from '../../../src/core/unitsConfig';

const files = {
	'src/routes/api/orders/+server.ts': 'export function GET() { return new Response("orders"); }',
	'src/routes/api/orders/[id]/+server.ts': 'export function GET() { return new Response("one"); }',
	'src/routes/api/unused/+server.ts': 'export function POST() { return new Response("unused"); }',
	'src/services/Orders.ts': 'export const load = () => fetch("/api/orders?limit=10");',
	'src/routes/orders/+page.svelte':
		'<script>import { load } from "../../services/Orders"; load(); fetch(`/api/orders/${id}`);</script>',
	'src/services/Remote.ts':
		'export const remote = () => fetch("https://elsewhere.example/api/orders");',
	'src/services/Unknown.ts': 'export const unknown = (url: string) => fetch(url);'
};

export async function assertHttpDependencies(): Promise<void> {
	const result = await measureWorkload('service.source-index', 'index-http-endpoint-usage', () =>
		indexFiles(files)
	);
	const units = result.result.manifests;
	const byPath = (path: string) => units.find((unit) => unit.owns.source.includes(path))!;
	const endpoint = byPath('src/routes/api/orders/+server.ts');
	const detail = byPath('src/routes/api/orders/[id]/+server.ts');
	const load = byPath('src/services/Orders.ts');
	expect(load.dependencies).toContainEqual({ unit: endpoint.id, via: 'http', origin: 'derived' });
	expect(byPath('src/routes/orders/+page.svelte').dependencies).toContainEqual({
		unit: detail.id,
		via: 'http',
		origin: 'derived'
	});
	expect(byPath('src/services/Remote.ts').dependencies).toEqual([]);
	expect(byPath('src/services/Unknown.ts').dependencies).toEqual([]);
	const changed = await indexFiles({
		...files,
		'src/services/Orders.ts': 'export const load = () => 1;'
	});
	expect(changed.result.manifests.find((unit) => unit.id === load.id)?.dependencies).toEqual([]);
	const other = await indexFiles(
		{
			'packages/one/package.json': '{"name":"one","type":"module"}',
			'packages/two/package.json': '{"name":"two","type":"module"}',
			'packages/one/src/services/Orders.ts': files['src/services/Orders.ts'],
			'packages/two/src/routes/api/orders/+server.ts': files['src/routes/api/orders/+server.ts']
		},
		[],
		{
			...defaultUnitsConfig,
			workspaces: [
				{ name: 'one', root: 'packages/one' },
				{ name: 'two', root: 'packages/two' }
			]
		}
	);
	expect(
		other.result.manifests.find((unit) =>
			unit.owns.source.some((path) => path.endsWith('Orders.ts'))
		)?.dependencies
	).toEqual([]);
}

test(
	'HTTP requests bind to endpoints in the owning app and selected source tree',
	assertHttpDependencies
);
