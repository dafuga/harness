import type { Repository, Session } from './serializer.claude-tools.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { ClaudeToolsSerializer } from '../../src/serializers/agents-providers/claude-tools-serializer/ClaudeToolsSerializer';

const META = {
	unitId: 'serializer.claude-tools',
	symbol: 'server',
	evidence: 'examples-cases'
};

const SEARCH_FILES = {
	type: 'function',
	name: 'search_files',
	description: 'Search repository files by query.',
	parameters: {
		type: 'object',
		properties: { query: { type: 'string' } },
		required: ['query']
	}
};

const APPLY_PATCH = {
	type: 'custom',
	name: 'apply_patch',
	description: 'Apply a patch to files.'
};

const UNSUPPORTED = { type: 'webhook', name: 'notify', description: 'Not a tool.' };

function makeSerializer(): ClaudeToolsSerializer {
	const repository = { waitForTool: () => Promise.resolve({}) };
	return new ClaudeToolsSerializer(repository as unknown as Repository);
}

function makeSession(): Session {
	return {
		id: 'session-1',
		controller: new AbortController(),
		pending: new Map(),
		delivered: new Set(),
		running: true,
		replays: new Map()
	};
}

test('Builds a codex SDK server from a function definition', () => {
	const definitions = [SEARCH_FILES];
	const server = makeSerializer().server(definitions, makeSession());

	expect(server).toMatchObject({ type: 'sdk', name: 'codex' });
	recordExampleCases(
		{ ...META, state: 'builds-a-codex-sdk-server-from-a-function-definition', file: 'builds-a-codex-sdk-server-from-a-function-definition.json' },
		[
			{
				name: 'one function definition with a required query parameter',
				input: definitions,
				output: { type: server.type, name: server.name }
			}
		]
	);
});

test('Builds a codex SDK server from a custom definition', () => {
	const definitions = [APPLY_PATCH];
	const server = makeSerializer().server(definitions, makeSession());

	expect(server).toMatchObject({ type: 'sdk', name: 'codex' });
	recordExampleCases(
		{ ...META, state: 'builds-a-codex-sdk-server-from-a-custom-definition', file: 'builds-a-codex-sdk-server-from-a-custom-definition.json' },
		[
			{
				name: 'one custom definition receives a string input field',
				input: definitions,
				output: { type: server.type, name: server.name }
			}
		]
	);
});

test('Rejects a definition whose type is not function or custom', () => {
	let error: unknown;
	try {
		makeSerializer().server([UNSUPPORTED], makeSession());
	} catch (caught) {
		error = caught;
	}

	expect((error as Error).name).toBe('GatewayToolDefinitionError');
	expect((error as Error).message).toContain('Unsupported');
	recordExampleCases(
		{ ...META, state: 'rejects-a-definition-whose-type-is-not-function-or-custom', file: 'rejects-a-definition-whose-type-is-not-function-or-custom.json' },
		[
			{
				name: 'webhook definition type is rejected while creating its tool',
				input: [UNSUPPORTED],
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});
