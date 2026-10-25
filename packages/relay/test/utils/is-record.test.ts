import { test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/development-tooling/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import unit from '../../../../test/fixtures/contract-migration/relay-is-record-examples.json' with { type: 'json' };
import { isRecord } from '../../src/utils/isRecord';

/** JSON cannot carry these values, so each authored marker names the value its call rebuilds. */
function reconstructArgument(argument: unknown): unknown {
	if (typeof argument !== 'object' || argument === null || !Object.hasOwn(argument, '$fixture'))
		return argument;
	const marker = argument as Record<string, string>;
	switch (marker.$fixture) {
		case 'undefined':
			return undefined;
		case 'null-prototype':
			return Object.create(null);
		case 'symbol':
			return Symbol(marker.description);
		case 'bigint':
			return BigInt(marker.value);
		default:
			throw new Error(`Unknown authored fixture ${marker.$fixture}`);
	}
}

/** Calls the public isRecord entry with the rebuilt argument, as each displayed call states. */
function invokeIsRecord(...input: never[]): boolean {
	const [argument] = input as unknown as [unknown];
	return isRecord(reconstructArgument(argument));
}

new TestExpectationService().registerExamples(test, unit as ComponentManifest, {
	isRecord: invokeIsRecord
});
