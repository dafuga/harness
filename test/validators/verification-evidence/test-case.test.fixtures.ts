import type { ComponentManifest } from '../../../src/core/unitTypes';
import type { ContractCase } from '../../../src/services/verification-evidence/TestContractService';
import type { SyntheticMethodLifecycleFixture } from './test-case.test.types';

export const methodLifecycleDiagnostics = {
	missingPair: 'missing method/state pair: Synthetic.run/cancelled',
	undeclaredPair: 'undeclared method/state pair: Synthetic.ready/cancelled',
	missingMethod: 'missing methodStates declaration for owned method: Synthetic.run',
	unknownMethod: 'methodStates references an unknown method',
	constructorMethod: 'methodStates cannot declare constructor methods',
	emptyMap: 'methodStates must not be empty',
	emptyList: 'methodStates for Synthetic.ready must not be empty',
	duplicateStates: 'methodStates for Synthetic.ready contains duplicate states',
	invalidState: 'methodStates contains an invalid state identifier',
	unsupportedShape: 'methodStates is only supported for service contracts',
	ambiguousGlobalStates: 'methodStates cannot be combined with global states'
} as const;

export function syntheticMethodLifecycleFixture(
	unit: ComponentManifest,
	item: ContractCase
): SyntheticMethodLifecycleFixture {
	const owner = {
		...unit,
		owns: { ...unit.owns, symbols: ['Synthetic.ready', 'Synthetic.run'] }
	};
	const methodStates = {
		'Synthetic.ready': ['qualified', 'unconfigured'],
		'Synthetic.run': ['qualified', 'cancelled']
	};
	const cases = Object.entries(methodStates).flatMap(([subject, states]) =>
		states.map((state) => ({
			...item,
			id: subject + '.' + state,
			subject,
			state,
			test: { ...item.test, title: subject + ' ' + state }
		}))
	);

	return {
		owner,
		contract: {
			version: 1,
			shape: 'service',
			methodStates,
			cases
		}
	};
}
