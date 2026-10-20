import { expect, test } from 'vitest';
import { IpcRequestValidator } from '../src/validators/IpcRequestValidator';

const request = {
	intent: 'create',
	category: 'functions',
	mode: 'plan',
	provider: 'claude',
	model: 'listed-model',
	effort: 'xhigh',
	text: 'Add a formatter',
	projectId: 'local-' + 'a'.repeat(64)
};
const parse = (input: unknown) => new IpcRequestValidator().parse('run:start', input);

test('the existing run channel carries a creation plan without fabricated entity IDs', () => {
	expect(parse(request)).toEqual(request);
});

test.each([
	{ mode: 'change', approval: { version: 'v001', imageHashes: [], contractHash: 'a'.repeat(64) } },
	{ intent: 'delete', entityId: 'component:existing', threadId: 'existing-thread', approval: null },
	{ category: 'unknown' },
	{ text: '' },
	{ text: 'x'.repeat(20001) },
	{ entityId: 'component:existing', threadId: 'existing-thread' },
	{ projectId: undefined },
	{ projectId: 'not-a-project' }
])('invalid creation request is refused: %j', (extra) => {
	expect(() => parse({ ...request, ...extra })).toThrow();
});

test('project changes carry only a canonical environment across the IPC boundary', () => {
	const task = {
		...request,
		intent: 'task',
		mode: 'change',
		branch: 'main',
		commit: 'b'.repeat(40),
		conversation: [],
		environment: 'preprod'
	};
	expect(parse(task)).toEqual(task);
	expect(() => parse({ ...task, environment: 'production' })).toThrow();
});
