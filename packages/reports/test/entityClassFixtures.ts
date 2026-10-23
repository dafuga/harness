import type { HarnessUnit } from '../src/models/Harness.types';
import type { ModelDefinition } from '../../../src/utils/unitMetadata';
import type { Reads } from './entityClassFixtures.types';
import type { ExplorerEntity } from '../src/models/Explorer.types';
import type { entityCatalog } from '../src/utils/entityCatalog';
/** Class evidence shared by the normal catalog, detail and browser fixtures. */
export function serviceClassProof(
	name = 'OrderStore',
	source = 'src/services/OrderStore.ts',
	consumers: Array<{ unit: string }> = []
) {
	return {
		name,
		source,
		methods: ['read', 'write'],
		constructedBy: consumers.slice(0, 1),
		consumers
	};
}

export function serviceMetadata(
	consumers: Array<{ unit: string }> = [],
	name?: string,
	source?: string
) {
	return {
		serviceConsumers: consumers,
		serviceClasses: [serviceClassProof(name, source, consumers)]
	};
}

/** Fail closed when declaration, instance, method or per-class sharing proof is absent. */
export function invalidServiceClasses(proof: ReturnType<typeof serviceClassProof>) {
	return [
		undefined,
		[],
		[{ ...proof, methods: ['read'] }],
		[{ ...proof, methods: [] }],
		[{ ...proof, constructedBy: [] }],
		[{ ...proof, name: 'orderStore' }],
		[{ ...proof, consumers: proof.consumers.slice(0, 1) }],
		[{ ...proof, source: 'src/unowned.ts' }]
	];
}

function observed<T>(items: T[], reads: Reads): T[] {
	class Observed extends Array<T> {
		static get [Symbol.species]() {
			reads.species++;
			return Array;
		}
	}
	const list = new Observed(...items);
	const first = list[0];
	Object.defineProperty(list, '0', {
		get() {
			reads.indexed++;
			return first;
		}
	});
	Object.defineProperty(list, Symbol.iterator, {
		value: function () {
			reads.iterated++;
			return [][Symbol.iterator]();
		}
	});
	return list;
}

/** Preserve the public entry's indexed-array admission before any JSON serialization. */
export function admission(
	catalog: typeof entityCatalog,
	entities: ExplorerEntity[],
	relations: Parameters<typeof entityCatalog>[2]
): string[] {
	const errors: string[] = [];
	const original = entities.find((entity) => entity.category === 'services')!;
	const ownerReads = { species: 0, indexed: 0, iterated: 0 };
	const entityReads = { species: 0, indexed: 0, iterated: 0 };
	const consumers = observed(original.unit.serviceConsumers ?? [], ownerReads);
	const metadata = serviceMetadata(consumers, original.name, original.unit.owns.source[0]);
	Object.assign(ownerReads, { species: 0, indexed: 0, iterated: 0 });
	const entity = { ...original, unit: { ...original.unit, ...metadata } };
	const input = observed(
		[entity, ...entities.filter((item) => item.id !== original.id)],
		entityReads
	);
	const shown = catalog(input, 'services', relations);
	if (shown.length !== 1 || shown[0].id !== original.id || shown[0].usedIn?.length !== 2)
		errors.push('indexed entities and consumers must retain the shared class row');
	for (const [label, actual, expected] of [
		['entities', entityReads, { species: 2, indexed: 2, iterated: 0 }],
		['owners', ownerReads, { species: 1, indexed: 1, iterated: 0 }]
	] as const)
		if (JSON.stringify(actual) !== JSON.stringify(expected))
			errors.push(`${label}: ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
	return errors;
}

/** Concrete private classes used by the standard relationship matrix. */
export function relationServiceMetadata(kind: string, offset: number, owner: string) {
	return kind === 'service'
		? serviceMetadata([{ unit: owner }], `Consumer${offset + 1}`, relationSource(kind, offset))
		: {};
}

/** Source ownership of each standard relationship fixture. */
export function relationSource(kind: string, offset: number): string {
	if (kind === 'service') return `src/routes/orders/Consumer${offset + 1}.ts`;
	if (kind === 'page') return `src/routes/consumers/${offset + 1}/+page.svelte`;
	return `src/${kind}s/Consumer${offset + 1}.${['component', 'shell'].includes(kind) ? 'svelte' : 'ts'}`;
}

/** Synthetic declaration evidence shared by normal model and type catalog matrices. */
export function modelDefinition(name: string, source: string) {
	const types = /\.(?:types|d)\.[cm]?tsx?$/.test(source);
	return {
		name,
		source,
		kind: types ? ('interface' as const) : ('class' as const),
		fields: [{ name: 'id', type: 'string', optional: false }],
		methods: [],
		...(types
			? {}
			: {
					table: {
						name: name.toLowerCase(),
						primaryKey: 'id',
						columns: [
							{ property: 'id', name: 'id', type: 'TEXT', nullable: false, primaryKey: true }
						]
					}
				})
	};
}

/** Shared declaration shapes exercise fields, signatures, aliases and source ownership. */
export function typeDeclarations(source: string): ModelDefinition[] {
	const first = modelDefinition('OrderInput', source);
	return [
		{
			...first,
			fields: [...first.fields, { name: 'note', type: 'string', optional: true }],
			methods: [{ name: 'resolve', inputs: [{ name: 'key', type: 'string' }], output: 'number' }]
		},
		{ ...first, name: 'OrderIds', kind: 'type', fields: [], type: 'string[]' },
		{ ...first, name: 'ForeignInput', source: 'src/Other.types.ts' }
	];
}

/** Persisted wrappers and an independent shared declaration module used by consumer cards. */
export function consumerModels(seed: HarnessUnit) {
	const model = {
		...seed,
		id: 'app.model.order',
		kind: 'model',
		title: 'Order',
		responsibility: 'Wraps stored order data.',
		owns: {
			source: ['src/models/Order.ts', 'src/models/Order.types.ts'],
			symbols: ['Order']
		},
		modelDefinitions: [modelDefinition('Order', 'src/models/Order.ts')]
	};
	const secondModel = {
		...model,
		id: 'app.model.invoice',
		title: 'Invoice',
		owns: { source: ['src/models/Invoice.ts'], symbols: ['Invoice'] },
		modelDefinitions: [modelDefinition('Invoice', 'src/models/Invoice.ts')]
	};
	const types = {
		...model,
		id: 'app.model.order-input',
		title: 'OrderInput',
		responsibility: 'Describes the input data for an order.',
		owns: {
			source: ['src/models/OrderInput.types.ts', 'src/models/OrderInputValues.ts'],
			symbols: ['OrderInput']
		},
		modelDefinitions: [modelDefinition('OrderInput', 'src/models/OrderInput.types.ts')]
	};
	return [model, secondModel, types];
}
