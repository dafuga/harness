import { test, vi } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { HarnessApiService } from '../../src/services/networking-security/HarnessApiService';
import type { HarnessApiOptions } from '../../src/services/networking-security/HarnessApiService.types';

const UNIT_ID = 'service.networking-security-harness-api';
const LOOPBACK = 'http://127.0.0.1:5690';
const TOKEN_MESSAGE = 'Supply the name of a token environment variable.';
const TIMEOUT_MESSAGE = 'API timeout must be an integer between 1 and 3600000 milliseconds.';
const PROJECT_MESSAGE = 'Select a hosted project with --project or HARNESS_API_PROJECT.';

type ErrorCase = { name: string; message: string };

function errorOf(action: () => unknown): ErrorCase {
	try {
		action();
	} catch (caught) {
		const error = caught as Error;
		return { name: error.name, message: error.message };
	}
	throw new Error('Expected the call to throw');
}

async function rejectionOf(action: () => Promise<unknown>): Promise<ErrorCase> {
	try {
		await action();
	} catch (caught) {
		const error = caught as Error;
		return { name: error.name, message: error.message };
	}
	throw new Error('Expected the call to reject');
}

function constructorError(options: HarnessApiOptions): ErrorCase {
	return errorOf(() => new HarnessApiService(options));
}

async function hostedWithoutProject(): Promise<{ read: ErrorCase; call: ErrorCase }> {
	const service = new HarnessApiService({ mode: 'hosted', url: LOOPBACK });
	return {
		read: await rejectionOf(() => service.read('snapshot')),
		call: await rejectionOf(() => service.call('createPlan', {}))
	};
}

test('Rejects a token environment name that is not valid', () => {
	const options = { tokenEnv: '1-BAD NAME' };
	const error = constructorError(options);

	expect(error.message).toBe(TOKEN_MESSAGE);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'HarnessApiService',
			state: 'rejects-a-token-environment-name-that-is-not-valid',
			evidence: 'examples-cases',
			file: 'rejects-a-token-environment-name-that-is-not-valid.json'
		},
		[{ name: 'tokenEnv with a space and leading digit is refused', input: options, error }]
	);
});

test('Selects hosted mode for a configured project', () => {
	const options = { project: 'harness-demo', url: LOOPBACK };
	const service = new HarnessApiService(options);
	const modeError = constructorError({ mode: 'remote' as 'hosted' });

	expect(service.hosted).toBe(true);
	expect(service.project).toBe('harness-demo');
	expect(modeError.message).toBe('API mode must be local or hosted.');
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'HarnessApiService',
			state: 'selects-hosted-mode-for-a-configured-project',
			evidence: 'examples-cases',
			file: 'selects-hosted-mode-for-a-configured-project.json'
		},
		[
			{
				name: 'project with a loopback url selects hosted mode',
				input: options,
				output: { hosted: service.hosted, project: service.project }
			},
			{ name: 'unknown mode value is refused', input: { mode: 'remote' }, error: modeError }
		]
	);
});

test('Rejects a timeout outside the safe range', () => {
	const low = { timeout: '0' };
	const high = { timeout: '3600001' };
	const lowError = constructorError(low);
	const highError = constructorError(high);
	const local = new HarnessApiService({ mode: 'local', url: LOOPBACK, timeout: '30000' });

	expect(lowError.message).toBe(TIMEOUT_MESSAGE);
	expect(highError.message).toBe(TIMEOUT_MESSAGE);
	expect(local.hosted).toBe(false);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'HarnessApiService',
			state: 'rejects-a-timeout-outside-the-safe-range',
			evidence: 'examples-cases',
			file: 'rejects-a-timeout-outside-the-safe-range.json'
		},
		[
			{ name: 'timeout of zero is refused', input: low, error: lowError },
			{ name: 'timeout above 3600000 is refused', input: high, error: highError },
			{
				name: 'timeout of 30000 with loopback local mode is accepted',
				input: { mode: 'local', url: LOOPBACK, timeout: '30000' },
				output: { hosted: local.hosted }
			}
		]
	);
});

test('Requires a selected project before hosted reads', async () => {
	vi.stubEnv('HARNESS_API_PROJECT', '');
	const result = await hostedWithoutProject().finally(() => vi.unstubAllEnvs());

	expect(result.read.message).toBe(PROJECT_MESSAGE);
	expect(result.call.message).toBe(PROJECT_MESSAGE);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'HarnessApiService.read',
			state: 'requires-a-selected-project-before-hosted-reads',
			evidence: 'examples-cases',
			file: 'requires-a-selected-project-before-hosted-reads.json'
		},
		[
			{
				name: 'read of snapshot without a hosted project is refused before any request',
				input: { mode: 'hosted', resource: 'snapshot' },
				error: result.read
			},
			{
				name: 'call of createPlan without a hosted project fails at the snapshot preflight',
				input: { mode: 'hosted', method: 'createPlan' },
				error: result.call
			}
		]
	);
});
