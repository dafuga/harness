import type { HarnessRevision } from '../src/models/Harness.types';
import { ids } from './entityUnits';

/** Committed usage documentation differs at each revision; it is never verification evidence. */
export function withDocumentation(detail: HarnessRevision): HarnessRevision {
	const name =
		detail.commit === 'c'.repeat(40) ? 'Find a matching order' : 'Search the earlier catalog';
	const examples = [
		{
			name,
			description: 'Search names without changing the original list.',
			call: 'filterOrders(["Service call", "New installation"], "SERVICE")',
			input: { search: 'SERVICE' },
			output: ['Service call']
		},
		{
			name: 'No matching order',
			call: 'filterOrders(["Service call", "New installation"], "<tag>")',
			input: { search: '<tag>' },
			output: []
		},
		{ name: 'Preserve empty values', input: { enabled: false, limit: 0, empty: null }, output: '' }
	];
	const documentation = {
		path: 'src/functions/filterOrders/README.md',
		text: '# filterOrders\n\nCommitted usage documentation.',
		examples
	};
	const units = detail.registry.units.map((unit) =>
		unit.id === ids.filter ? { ...unit, documentation } : unit
	);
	return { ...detail, registry: { ...detail.registry, units } };
}
