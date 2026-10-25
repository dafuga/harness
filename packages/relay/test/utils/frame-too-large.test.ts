import { test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import manifest from '../../../../test/fixtures/contract-migration/relay-frame-too-large-examples.json' with {
	type: 'json'
};
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
	const actualMessage =
		marker?.$fixture === 'repeat-string'
			? String(marker.character).repeat(Number(marker.count))
			: marker?.$fixture === 'ArrayBuffer'
				? new ArrayBuffer(Number(marker.byteLength))
				: message;
	return frameTooLarge(actualMessage as string | ArrayBuffer, limit);
}

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	frameTooLarge: invokeFrameTooLarge
});
