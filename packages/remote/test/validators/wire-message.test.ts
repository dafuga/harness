import { expect, test } from 'vitest';
import { RemoteFailure, remoteLimits } from '../../src/models/Remote.types';
import { WireMessageValidator } from '../../src/validators/WireMessageValidator';

const id = '8775318f-d765-4e78-9d40-6cb92e1f6b11',
	validator = new WireMessageValidator(),
	text = (value: unknown) => JSON.stringify(value);
const request = (overrides: Record<string, unknown> = {}) =>
	text({ type: 'request', id, method: 'snapshot', input: { projectId: 'p' }, ...overrides });
function failure(run: () => unknown): RemoteFailure {
	try {
		run();
	} catch (error) {
		if (error instanceof RemoteFailure) return error;
	}
	throw new Error('Expected a RemoteFailure.');
}

test('a request has exactly type, id, a listed method and an object input', () => {
	expect(validator.request(request())).toEqual({
		type: 'request',
		id,
		method: 'snapshot',
		input: { projectId: 'p' }
	});
});
test('methods outside the list do not exist, whatever they are called', () => {
	for (const method of ['shell.run', 'fs.read', 'eval', '__proto__', 'constructor', 'toString']) {
		const refused = failure(() => validator.request(request({ method })));
		expect(refused.code).toBe('unknown-method');
		expect(refused.requestId).toBe(id);
	}
});
test('malformed envelopes are invalid messages', () => {
	const cases = [
		'not json',
		'[]',
		'null',
		'"request"',
		text({ type: 'request', id, method: 'snapshot' }),
		request({ input: [] }),
		request({ input: null }),
		request({ input: 'x' }),
		request({ id: '1' }),
		request({ id: id.toUpperCase() }),
		request({ type: 'call' }),
		request({ method: 5 }),
		request({ extra: 1 })
	];
	for (const item of cases)
		expect(failure(() => validator.request(item)).code).toBe('invalid-message');
});
test('an invalid envelope with a usable id can still be answered', () => {
	expect(failure(() => validator.request(request({ extra: 1 }))).requestId).toBe(id);
	expect(failure(() => validator.request('not json')).requestId).toBeUndefined();
	expect(failure(() => validator.request(request({ id: 'nope' }))).requestId).toBeUndefined();
});
test('requests above the byte bound are refused, counting bytes and not characters', () => {
	const ascii = request({ input: { text: 'x'.repeat(remoteLimits.requestBytes) } }),
		multibyte = request({ input: { text: 'é'.repeat(remoteLimits.requestBytes / 2) } });
	expect(multibyte.length).toBeLessThan(remoteLimits.requestBytes);
	expect(failure(() => validator.request(ascii)).code).toBe('too-large');
	expect(failure(() => validator.request(multibyte)).code).toBe('too-large');
});
test('a client accepts responses and events and nothing else', () => {
	const ok = { type: 'response', id, ok: true, value: { a: 1 } },
		refused = { type: 'response', id, ok: false, error: { code: 'busy', message: 'Busy' } },
		event = { type: 'event', channel: 'run', sequence: 3, value: { kind: 'cancelled' } };
	for (const message of [ok, refused, event])
		expect(validator.message(text(message))).toEqual(message);
	const bad = [
		request(),
		text({ ...event, channel: 'shell' }),
		text({ ...event, sequence: 0 }),
		text({ ...event, sequence: 1.5 }),
		text({ ...event, sequence: '3' }),
		text({ ...event, extra: true }),
		text({ ...refused, error: { code: 'made-up', message: 'x' } }),
		text({ ...refused, error: { code: 'busy' } }),
		text({ ...ok, error: { code: 'busy', message: 'x' } }),
		text({ type: 'response', id, ok: 'yes', value: 1 }),
		'not json'
	];
	for (const item of bad) expect(() => validator.message(item)).toThrow(RemoteFailure);
});
