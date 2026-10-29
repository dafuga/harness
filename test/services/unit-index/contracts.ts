import { expect } from 'vitest';
import { indexFiles, unitOf } from '../../support/memoryTree';
import { measureWorkload } from '../../support/measureWorkload';

const declarations = {
	'src/utils/call.ts': `export function call(name: string, size = 16, flag?: boolean,
		{ enabled = true }: { enabled?: boolean } = {}): string { return name; }
export function reject(input: string): never { throw new RangeError(input); }
export function relay(error: Error): never { throw error; }`,
	'src/services/StoreService.ts': `export class StoreService {
		constructor(readonly root: string = '/tmp') {}
		read(id: string, cached?: boolean): string { return id; }
		write(id: string): void { throw new TypeError(id); }
	}`,
	'src/components/Panel.svelte': `<script module lang="ts">
		export function describe(node: string): string { return node; }
	</script><script lang="ts">
		type Props = { title: string; size?: number; children?: Snippet };
		let { title, size = 16, children }: Props = $props();
		function inside() { let { wrong }: { wrong: string } = $props(); }
	</script>{#snippet row(node: string, text?: string)}{node}{/snippet}`,
	'src/components/Wrapper.svelte': `<script lang="ts">
		import type { ComponentProps } from 'svelte';
		import Panel from './Panel.svelte';
		let { title, size = 16, children }: ComponentProps<typeof Panel> = $props();
	</script>`,
	'src/models/Entry.ts': `export class Entry {
		static definition = { table: 'entries', primaryKey: 'id', fields: {
			id: { type: 'string' }, title: { type: 'string', nullable: true },
			owner: { type: 'string', validation: { min: 1 }, relations: { table: 'users' } }
		}} as const;
		static find(adapter: Adapter, id: string): Promise<EntryAttributes | null> { return adapter.find(id); }
	}`,
	'src/models/Entry.types.ts':
		'export interface EntryAttributes { id: string; title: string | null; owner: string }'
};

/** SourceIndexService.index and UnitIndexService.index: callable, component and storage states. */
export async function assertContractExtraction(): Promise<void> {
	const indexed = await measureWorkload('service.source-index', 'derive-contract-states', () =>
		indexFiles(declarations)
	);
	const contract = (id: string) => unitOf(indexed, id).contract;
	const call = contract('function.call');
	expect.soft(call.inputs).toEqual(
		expect.arrayContaining([
			{ name: 'call.name', type: 'string', required: true },
			{ name: 'call.size', type: 'number', required: false, default: 16 },
			{ name: 'call.flag', type: 'boolean', required: false },
			{ name: 'call.enabled', type: 'boolean', required: false, default: true }
		])
	);
	expect
		.soft(call.operations?.map((operation) => operation.name))
		.toEqual(['call', 'reject', 'relay']);
	expect.soft(call.operations?.[0]).toMatchObject({ errors: [], errorStatus: 'none-found' });
	expect
		.soft(call.operations?.[1])
		.toMatchObject({ errors: [{ name: 'RangeError', type: 'thrown' }] });
	expect.soft(call.operations?.[2]).toMatchObject({ errorStatus: 'unknown' });
	const panel = contract('component.panel');
	expect.soft(panel.inputs).toEqual([
		{ name: 'Panel.title', type: 'string', required: true },
		{ name: 'Panel.size', type: 'number', required: false, default: 16 },
		{ name: 'Panel.children', type: 'Snippet', required: false }
	]);
	expect.soft(panel.snippets?.[0]).toMatchObject({
		name: 'Panel.row',
		inputs: [
			{ name: 'Panel.row.node', type: 'string', required: true },
			{ name: 'Panel.row.text', type: 'string', required: false }
		]
	});
	expect
		.soft(contract('component.wrapper').inputs)
		.toEqual(
			panel.inputs.map((item) => ({ ...item, name: item.name.replace('Panel.', 'Wrapper.') }))
		);
	const service = contract('service.store');
	expect
		.soft(service.initialization?.[0])
		.toMatchObject({
			name: 'StoreService.constructor',
			inputs: [
				{ name: 'StoreService.constructor.root', type: 'string', required: false, default: '/tmp' }
			]
		});
	expect
		.soft(service.operations?.map((operation) => operation.name))
		.toEqual(['StoreService.read', 'StoreService.write']);
	expect.soft(service.operations?.[0].errors).toEqual([]);
	expect.soft(service.operations?.[1].errors).toEqual([{ name: 'TypeError', type: 'thrown' }]);
	const model = unitOf(indexed, 'model.entry');
	expect.soft(model.owns.source).toEqual(['src/models/Entry.ts', 'src/models/Entry.types.ts']);
	expect.soft(contract(model.id).storage?.[0]).toMatchObject({
		name: 'Entry',
		table: 'entries',
		primaryKey: 'id',
		fields: [
			{ name: 'id', type: 'string', required: true, nullable: false, primaryKey: true },
			{ name: 'title', type: 'string', required: false, nullable: true, primaryKey: false },
			{
				name: 'owner',
				type: 'string',
				required: true,
				nullable: false,
				primaryKey: false,
				validation: '{ min: 1 }',
				relations: "{ table: 'users' }"
			}
		]
	});
}
