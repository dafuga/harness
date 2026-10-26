import { expect } from 'vitest';
import type { ComponentManifest } from '../../src/core/unitTypes';
import type { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import type { ContractCase } from '../../src/services/verification-evidence/TestContractService';

/** The existing method case compares actual callback outcomes with authored results. */
export async function assertRegisteredResults(
	service: TestExpectationService,
	unit: ComponentManifest,
	file: string
) {
	const run = (expected: NonNullable<ContractCase['expected']>, invoke: () => unknown) => {
		const callbacks: Array<() => Promise<void>> = [];
		const contract = {
			...unit,
			testing: {
				...unit.testing!,
				cases: [{ ...unit.testing!.cases[0], expected }]
			}
		};
		service.registerCases((_title, callback) => callbacks.push(callback), contract, file, {
			'run.initialized': invoke
		});
		return callbacks[0]();
	};
	await expect(run({ kind: 'void' }, () => 1)).rejects.toThrow('differs from its comment');
	const expected = { kind: 'value' as const, value: { values: [false, 0, '', null] } };
	await expect(run(expected, () => ({ values: [false, 0, '', null] }))).resolves.toBeUndefined();
	for (const actual of [undefined, { values: [false, 0, '', null], extra: true }, { values: [0] }])
		await expect(run(expected, () => actual)).rejects.toThrow('differs from its comment');
	const failure = {
		kind: 'error' as const,
		value: { name: 'TypeError', message: 'Invalid input' }
	};
	await expect(
		run(failure, () => {
			throw new TypeError('Invalid input');
		})
	).resolves.toBeUndefined();
	await expect(run(failure, () => undefined)).rejects.toThrow('Expected example to fail');
	await expect(
		run(failure, () => {
			throw new Error('Invalid input');
		})
	).rejects.toThrow('differs from its comment');
	await expect(
		run({ kind: 'void' }, () => {
			throw new Error('Unexpected');
		})
	).rejects.toThrow('unexpectedly failed');
}
