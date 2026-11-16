import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { ExperimentalAppBuildError } from '../../scripts/prepare-desktop-experiment.types';

test('Creates the declared experimental app build error', () => {
	const message = 'Bridge build failed';
	const error = new ExperimentalAppBuildError(message);
	expect(error).toBeInstanceOf(Error);
	expect(error.name).toBe('ExperimentalAppBuildError');
	expect(error.message).toBe(message);
	recordExampleCases(
		{
			unitId: 'script.prepare-desktop-experiment',
			symbol: 'ExperimentalAppBuildError',
			state: 'creates-the-declared-experimental-app-build-error',
			evidence: 'examples-cases',
			file: 'creates-the-declared-experimental-app-build-error.json'
		},
		[
			{
				name: 'bridge build failure',
				input: { message },
				output: {
					name: error.name,
					message: error.message,
					isError: error instanceof Error
				}
			}
		]
	);
});
