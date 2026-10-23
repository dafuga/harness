import type { Documentation } from './entityPreviewServiceDocs.types';
import type { HarnessRevision, HarnessUnit } from '../src/models/Harness.types';
import { commits, ids } from './entityUnits';
const path = 'docs/order-store.md';

/**
 * Committed OrderStore usage of the synthetic history. The middle commit keeps an earlier
 * document and the first a malformed one, so no revision borrows the examples of another.
 */
const documents: Record<string, Documentation> = {
	[commits.first]: { path, examples: [], gap: 'The documented examples are malformed.' },
	[commits.middle]: {
		path,
		setup: 'const store = new OrderStore("account-7");',
		examples: [
			{
				name: 'Read the earlier order list',
				call: 'await store.list()',
				input: [],
				output: ['Order 1042']
			}
		]
	},
	[commits.tip]: {
		path,
		setup: 'const store = new OrderStore(accountId);',
		examples: [
			{
				name: 'Read the orders of an account',
				call: 'await store.orders()',
				input: [],
				output: [{ id: 1042, name: 'Service call' }]
			},
			{
				name: 'Search orders by name',
				call: 'await store.search("SERVICE")',
				input: ['SERVICE'],
				output: ['Service call']
			},
			{
				name: 'Find no order <tag>',
				call: 'await store.find({ id: 0, archived: false })',
				input: [{ id: 0, archived: false }],
				output: null
			},
			{
				name: 'Refuse an empty search',
				call: 'await store.search("")',
				input: [''],
				error: { name: 'RangeError', message: 'Search text is required.' }
			}
		]
	}
};

/** The selected revision with its own OrderStore document, as the history reads it from Git. */
export function withServiceDocumentation(detail: HarnessRevision): HarnessRevision {
	const documentation = documents[detail.commit];
	const units = detail.registry.units.map((unit) =>
		unit.id === ids.store ? { ...unit, documentation } : unit
	);
	return { ...detail, registry: { ...detail.registry, units } };
}
