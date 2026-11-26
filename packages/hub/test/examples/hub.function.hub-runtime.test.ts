import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubRuntime } from '../../src/routes/api/[...path]/hubRuntime';
import type { HubApiRuntime } from '../../src/utils/networking-security/hubRuntime';
import type { Env } from './hub.function.hub-runtime.test.types';

const unitId = 'hub.function.hub-runtime';
const localEnv: Env = { HARNESS_ENVIRONMENT: 'local' };
const collaborationEnv: Env = {
	HARNESS_COLLABORATION_OWNER: 'acme-labs',
	HARNESS_COLLABORATION_REPO: 'harness-workspace',
	HARNESS_COLLABORATION_REPOSITORY_ID: '812405173',
	HARNESS_COLLABORATION_INSTALLATION_ID: '47352811'
};
const collaborationDisabled = {
	code: 'collaboration-disabled',
	message: 'Harness artifact unavailable'
};

function runtimeFor(env: Env): HubApiRuntime {
	return hubRuntime(env);
}

function withEnv(overrides: Env): Env {
	return { ...collaborationEnv, ...overrides };
}

function connectFailure(env: Env): { code: unknown; message: unknown } {
	try {
		runtimeFor(env).connect();
	} catch (error) {
		const failure = error as { code?: unknown; message?: unknown };
		return { code: failure.code, message: failure.message };
	}
	throw new Error('connect() did not fail');
}

test('Builds a runtime with no relay in local mode', () => {
	const runtime = runtimeFor(localEnv);
	const summary = {
		remote: runtime.remote ?? null,
		agent: runtime.agent ?? null,
		hasAuth: runtime.auth !== undefined
	};
	expect(summary).toEqual({ remote: null, agent: null, hasAuth: true });
	recordExampleCases(
		{
			unitId,
			symbol: 'hubRuntime',
			state: 'builds-a-runtime-with-no-relay-in-local-mode',
			evidence: 'examples-cases',
			file: 'builds-a-runtime-with-no-relay-in-local-mode.json'
		},
		[
			{
				name: 'local environment without relay origin or database',
				input: localEnv,
				output: summary
			}
		]
	);
});

test('Connects collaboration for a configured repository', () => {
	const connected = runtimeFor(collaborationEnv).connect();
	const summary = {
		hasApi: connected.api !== undefined,
		hasProjection: connected.projection !== undefined
	};
	expect(summary).toEqual({ hasApi: true, hasProjection: true });
	recordExampleCases(
		{
			unitId,
			symbol: 'connect',
			state: 'connects-collaboration-for-a-configured-repository',
			evidence: 'examples-cases',
			file: 'connects-collaboration-for-a-configured-repository.json'
		},
		[{ name: 'owner, repo and numeric ids configured', input: collaborationEnv, output: summary }]
	);
});

test('Rejects connect when the repository id is invalid', () => {
	const invalidIds: Array<{ name: string; input: Env }> = [
		{ name: 'repository id is empty', input: withEnv({ HARNESS_COLLABORATION_REPOSITORY_ID: '' }) },
		{
			name: 'installation id is zero',
			input: withEnv({ HARNESS_COLLABORATION_INSTALLATION_ID: '0' })
		},
		{
			name: 'repository id is not numeric',
			input: withEnv({ HARNESS_COLLABORATION_REPOSITORY_ID: 'abc' })
		}
	];
	const cases = invalidIds.map(({ name, input }) => ({
		name,
		input,
		error: connectFailure(input)
	}));
	for (const item of cases) {
		expect(item.error).toEqual(collaborationDisabled);
	}
	recordExampleCases(
		{
			unitId,
			symbol: 'connect',
			state: 'rejects-connect-when-the-repository-id-is-invalid',
			evidence: 'examples-cases',
			file: 'rejects-connect-when-the-repository-id-is-invalid.json'
		},
		cases.map((item) => ({ name: item.name, input: item.input, error: item.error }))
	);
});

test('Rejects connect when owner or repo is empty', () => {
	const missingNames: Array<{ name: string; input: Env }> = [
		{ name: 'owner is empty', input: withEnv({ HARNESS_COLLABORATION_OWNER: '' }) },
		{ name: 'repo is empty', input: withEnv({ HARNESS_COLLABORATION_REPO: '' }) }
	];
	const cases = missingNames.map(({ name, input }) => ({
		name,
		input,
		error: connectFailure(input)
	}));
	for (const item of cases) {
		expect(item.error).toEqual(collaborationDisabled);
	}
	recordExampleCases(
		{
			unitId,
			symbol: 'connect',
			state: 'rejects-connect-when-owner-or-repo-is-empty',
			evidence: 'examples-cases',
			file: 'rejects-connect-when-owner-or-repo-is-empty.json'
		},
		cases.map((item) => ({ name: item.name, input: item.input, error: item.error }))
	);
});
