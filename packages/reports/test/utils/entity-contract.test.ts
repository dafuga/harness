import { test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import type { HarnessUnit } from '../../src/models/Harness.types';
import { entityContract, humanize, requiredStates } from '../../src/utils/entityContract';
import type { ContractFacts } from '../../src/utils/explorer-ui/entityContract';
import manifest from '../../../../test/fixtures/contract-migration/contract-examples.json';

type EntityInput = [HarnessUnit, ContractFacts];

const invokeEntityContract = (...input: never[]) => {
	const [rawUnit, facts] = input as unknown as EntityInput;
	if (rawUnit.id !== 'fixture.admitted-fields') return entityContract(rawUnit, facts);

	let descriptions = 0;
	let species = 0;
	const fields = rawUnit.contract.inputs.map((field, index) =>
		index === 0
			? {
					name: field.name,
					type: field.type,
					get description() {
						descriptions++;
						return field.description;
					}
				}
			: field
	) as HarnessUnit['contract']['inputs'];
	Object.defineProperty(fields, Symbol.iterator, {
		value: () => {
			throw new Error('Must not iterate');
		}
	});
	Object.defineProperty(fields, 'some', {
		value: () => {
			throw new Error('New array operation');
		}
	});
	Object.defineProperty(fields, 'constructor', {
		value: {
			get [Symbol.species]() {
				species++;
				return Array;
			}
		}
	});
	const unit = { ...rawUnit, contract: { ...rawUnit.contract, inputs: fields } };
	const output = entityContract(unit, facts);
	if (descriptions !== 2 || species !== 2)
		throw new Error(`Admitted field reads changed: ${descriptions}/${species}`);
	return output;
};

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	entityContract: invokeEntityContract,
	humanize,
	requiredStates
});
