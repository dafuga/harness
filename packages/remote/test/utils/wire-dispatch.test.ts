import { expect, test } from 'vitest';
import { RemoteFailure, remoteLimits } from '../../src/models/Remote.types';
import type { WireRequest } from '../../src/models/Remote.types';
import { ResponseLedgerService } from '../../src/services/ResponseLedgerService';
import { wireDispatch } from '../../src/utils/wireDispatch';
import type { WireDispatchContext } from '../../src/utils/wireDispatch';

const request = (method: WireRequest['method'], id = 'a'): WireRequest => ({
	type: 'request',
	id,
	method,
	input: { projectId: 'p' }
});
function context(overrides: Partial<WireDispatchContext> = {}) {
	const calls: string[] = [];
	const value: WireDispatchContext = {
		attached: true,
		methods: ['session.attach', 'snapshot', 'startRun'],
		pending: 0,
		limits: remoteLimits,
		ledger: new ResponseLedgerService(),
		handle: async (item) => {
			calls.push(item.method);
			return { done: item.method };
		},
		explain: () => ({ code: 'failed', message: 'Explained' }),
		...overrides
	};
	return { value, calls };
}

test('an allowed request is answered with its value', async () => {
	const { value } = context();
	expect(await wireDispatch(value, request('snapshot'))).toEqual({
		type: 'response',
		id: 'a',
		ok: true,
		value: { done: 'snapshot' }
	});
});
test('policy refusals never reach the handler', async () => {
	const cases: [Partial<WireDispatchContext>, WireRequest['method'], string][] = [
		[{ attached: false }, 'snapshot', 'not-attached'],
		[{}, 'openProject', 'method-denied'],
		[{ pending: remoteLimits.pendingRequests }, 'snapshot', 'too-many-requests']
	];
	for (const [overrides, method, code] of cases) {
		const { value, calls } = context(overrides);
		expect(await wireDispatch(value, request(method))).toMatchObject({
			ok: false,
			error: { code }
		});
		expect(calls).toEqual([]);
	}
});
test('a mutation runs once per id and a read runs every time', async () => {
	const { value, calls } = context();
	await wireDispatch(value, request('startRun', 'm'));
	await wireDispatch(value, request('startRun', 'm'));
	await wireDispatch(value, request('snapshot', 'r'));
	await wireDispatch(value, request('snapshot', 'r'));
	expect(calls).toEqual(['startRun', 'snapshot', 'snapshot']);
});
test('declared failures keep their code and others are explained', async () => {
	const busy = context({ handle: async () => Promise.reject(new RemoteFailure('busy')) });
	expect(await wireDispatch(busy.value, request('snapshot'))).toMatchObject({
		ok: false,
		error: { code: 'busy' }
	});
	const broken = context({ handle: async () => Promise.reject(new Error('/private/path')) });
	expect(await wireDispatch(broken.value, request('snapshot'))).toMatchObject({
		ok: false,
		error: { code: 'failed', message: 'Explained' }
	});
});
