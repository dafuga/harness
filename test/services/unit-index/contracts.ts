import { expect } from '../../verificationExpect';
import type { Indexed } from '../../support/memoryTree';
import type { ComponentManifest } from '../../../src/core/unitTypes';
import { indexFiles, unitOf } from '../../support/memoryTree';
import { measureWorkload } from '../../support/measureWorkload';
import { assertContractDocumentation } from './contractDocumentation';

const declarations = {
	'src/utils/call.ts': `export function call(name: string, size = 16, flag?: boolean, exact: string | undefined = void 0,
		computed = resolveValue(), literal = "undefined (omitted)",
		{ enabled = true }: { enabled?: boolean } = {}): string { return name; }
export function reject(input: string): never { throw new RangeError(input); }
export function shadowed(undefined: number, value: number = undefined): number { return value; }
export function relay(error: Error): never { throw error; }`,
	'src/services/StoreService.ts': `export class StoreService {
		constructor(readonly root: string = '/tmp') {}
		read(id: string, cached?: boolean): string { return id; }
		write(id: string): void { throw new TypeError(id); }
	}`,
	'src/components/Panel.svelte': `<script module lang="ts">
		export function describe(node: string): string { return node; }
	</script><script lang="ts">
		type Props = { title: string; size?: number; children?: Snippet; value: string; current: string; optional?: string; fallback?: string; exact?: string };
		let { title, size = 16, children, value = $bindable(), current: aliased = $bindable(), optional = $bindable(), fallback = $bindable('ready'), exact = $bindable(undefined) }: Props = $props();
		function inside() { let { wrong }: { wrong: string } = $props(); }
	</script>{#snippet row(node: string, text?: string)}{node}{/snippet}`,
	'src/components/Wrapper.svelte': `<script lang="ts">
		import type { ComponentProps } from 'svelte';
		import Panel from './Panel.svelte';
		let { title, size = 16, children, value = $bindable(), current: aliased = $bindable(), optional = $bindable(), fallback = $bindable('ready'), exact = $bindable(undefined) }: ComponentProps<typeof Panel> = $props();
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
		measureWorkload('function.scan-component', 'required-and-optional-bindable-props', () =>
			indexFiles(declarations)
		)
	);
	assertCallContract(unitOf(indexed, 'function.call').contract);
	assertComponentContracts(indexed);
	assertServiceContract(unitOf(indexed, 'service.store').contract);
	assertModelContract(indexed);
	await assertContractDocumentation(declarations, indexed);
}

function assertCallContract(call: ComponentManifest['contract']): void {
	expect(call.inputs).toEqual(
		expect.arrayContaining([
			{ name: 'call.name', type: 'string', required: true },
			{ name: 'call.size', type: 'number', required: false, default: 16 },
			{ name: 'call.flag', type: 'boolean', required: false, defaultKind: 'omitted' },
			{ name: 'call.exact', type: 'string | undefined', required: false, defaultKind: 'undefined' },
			{ name: 'call.computed', type: 'unknown', required: false },
			{ name: 'call.literal', type: 'string', required: false, default: 'undefined (omitted)' },
			{ name: 'shadowed.value', type: 'number', required: false },
			{ name: 'call.enabled', type: 'boolean', required: false, default: true }
		])
	);
	expect(call.operations?.map((operation) => operation.name)).toEqual([
		'call',
		'reject',
		'shadowed',
		'relay'
	]);
	expect(call.operations?.[0]).toMatchObject({ errors: [], errorStatus: 'none-found' });
	expect(call.operations?.[1]).toMatchObject({ errors: [{ name: 'RangeError', type: 'thrown' }] });
	expect(call.operations?.find(({ name }) => name === 'relay')).toMatchObject({
		errorStatus: 'unknown'
	});
}

function assertComponentContracts(indexed: Indexed): void {
	const panel = unitOf(indexed, 'component.panel').contract;
	expect(panel.inputs, 'No-fallback bindable props retain source requiredness').toEqual([
		{ name: 'Panel.title', type: 'string', required: true },
		{ name: 'Panel.size', type: 'number', required: false, default: 16 },
		{ name: 'Panel.children', type: 'Snippet', required: false, defaultKind: 'omitted' },
		{ name: 'Panel.value', type: 'string', required: true },
		{ name: 'Panel.current', type: 'string', required: true },
		{ name: 'Panel.optional', type: 'string', required: false, defaultKind: 'omitted' },
		{ name: 'Panel.fallback', type: 'string', required: false, default: 'ready' },
		{ name: 'Panel.exact', type: 'string', required: false, defaultKind: 'undefined' }
	]);
	expect(panel.snippets?.[0]).toMatchObject({
		name: 'Panel.row',
		inputs: [
			{ name: 'Panel.row.node', type: 'string', required: true },
			{ name: 'Panel.row.text', type: 'string', required: false, defaultKind: 'omitted' }
		]
	});
	expect(unitOf(indexed, 'component.wrapper').contract.inputs).toEqual(
		panel.inputs.map((item) => ({ ...item, name: item.name.replace('Panel.', 'Wrapper.') }))
	);
}

function assertServiceContract(service: ComponentManifest['contract']): void {
	expect(service.initialization?.[0]).toMatchObject({
		name: 'StoreService.constructor',
		inputs: [
			{ name: 'StoreService.constructor.root', type: 'string', required: false, default: '/tmp' }
		]
	});
	expect(service.operations?.map((operation) => operation.name)).toEqual([
		'StoreService.read',
		'StoreService.write'
	]);
	expect(service.operations?.[0].errors).toEqual([]);
	expect(service.operations?.[1].errors).toEqual([{ name: 'TypeError', type: 'thrown' }]);
}

function assertModelContract(indexed: Indexed): void {
	const model = unitOf(indexed, 'model.entry');
	expect(model.owns.source).toEqual(['src/models/Entry.ts', 'src/models/Entry.types.ts']);
	expect(model.contract.storage?.[0]).toMatchObject({
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
