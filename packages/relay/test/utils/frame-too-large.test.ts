import { test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import manifest from '../../../../specification/units/relay.function.frame-too-large.json' with { type: 'json' };
import { frameTooLarge } from '../../src/services/socket-frame-service/frameTooLarge';

/** Rebuild authored repeat and ArrayBuffer markers before the real helper call. */
function invokeFrameTooLarge(...input: never[]) {
	const [message, limit] = input as unknown as [unknown, number?];
	const marker =
		typeof message === 'object' && message !== null
			? (message as {
					$fixture?: unknown;
					character?: unknown;
					count?: unknown;
					byteLength?: unknown;
				})
			: undefined;
	let actualMessage = message;
	if (marker?.$fixture === 'repeat-string')
		actualMessage = String(marker.character).repeat(Number(marker.count));
	else if (marker?.$fixture === 'ArrayBuffer')
		actualMessage = new ArrayBuffer(Number(marker.byteLength));
	return frameTooLarge(actualMessage as string | ArrayBuffer, limit);
}

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	frameTooLarge: invokeFrameTooLarge
});
