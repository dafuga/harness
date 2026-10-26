import { expect } from 'vitest';
import { gatewayContentError } from '../../src/utils/gatewayContentError';
import type {
	GatewayContentErrorFixture,
	GatewayContentErrorProjection
} from './gatewayContentErrorExamples.types';

/** JSON cannot carry these values, so each authored marker names the value its example rebuilds. */
function reconstructMessage(argument: unknown): unknown {
	if (typeof argument !== 'object' || argument === null || !Object.hasOwn(argument, '$fixture'))
		return argument;
	const marker = argument as GatewayContentErrorFixture;
	switch (marker.$fixture) {
		case 'undefined':
			return undefined;
		case 'symbol':
			return Symbol(marker.description);
		case 'bigint':
			return BigInt(marker.value);
		case 'null-prototype':
			return Object.create(null);
		case 'text-object':
			return { toString: () => marker.text };
		default:
			throw new Error(`Unknown authored fixture ${JSON.stringify(marker)}`);
	}
}

/**
 * Calls the public alias with the rebuilt message, keeping the Error-object checks in this case.
 * Returns the name and message projection that each Example displays and compares.
 */
export function invokeGatewayContentError(...input: never[]): GatewayContentErrorProjection {
	const [argument] = input;
	// Invalid authored messages reach the string parameter on purpose; the Error decides.
	const error = gatewayContentError(reconstructMessage(argument) as string);
	expect(error).toBeInstanceOf(Error);
	expect(error).toMatchObject({ name: 'GatewayContentError' });
	return { name: error.name, message: error.message };
}
