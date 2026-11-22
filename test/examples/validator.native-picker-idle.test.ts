import type { PickerRpc, RpcCall, PickerData } from './validator.native-picker-idle.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { NativePickerIdleValidator } from '../../src/validators/development-tooling/NativePickerIdleValidator';
import type { NativePickerIdleValidatorResult } from '../../src/validators/development-tooling/NativePickerIdleValidator.types';

const UNIT_ID = 'validator.native-picker-idle';
const THREAD_ID = 'b7e04c9d-2f18-4e63-a5c1-9d8e0f3a7b26';
const validator = new NativePickerIdleValidator();
const VALID: NativePickerIdleValidatorResult = { valid: true, errors: [] };
const INVALID: NativePickerIdleValidatorResult = {
	valid: false,
	errors: ['Provider switching requires an idle chat or a confirmed completed failure']
};
const SYSTEM_ERROR = { id: THREAD_ID, status: { type: 'systemError' } };
const UNCONFIRMED = [
	{ name: 'last turn still in progress', turns: [{ status: 'failed' }, { status: 'inProgress' }] },
	{ name: 'last turn completed', turns: [{ status: 'failed' }, { status: 'completed' }] },
	{ name: 'earlier turn still in progress', turns: [{ status: 'inProgress' }, { status: 'failed' }] }
];

function stateMeta(state: string): Parameters<typeof recordExampleCases>[0] {
	return { unitId: UNIT_ID, symbol: 'validate', state, evidence: 'examples-cases', file: `${state}.json` };
}

function recordingRpc(thread: unknown): { rpc: PickerRpc; calls: RpcCall[] } {
	const calls: RpcCall[] = [];
	const rpc: PickerRpc = async (method, params) => {
		calls.push({ method, params });
		return { thread };
	};
	return { rpc, calls };
}

async function rejectionOf(run: () => Promise<unknown>): Promise<{ name: string; message: string }> {
	try {
		await run();
	} catch (caught) {
		const error = caught as Error;
		return { name: error.name, message: error.message };
	}
	throw new Error('Expected the validation to reject');
}

test('Accepts an idle thread without reading its history', async () => {
	const { rpc, calls } = recordingRpc({});
	const input = { id: THREAD_ID, status: { type: 'idle' } };
	const output = await validator.validate(input, rpc);
	expect(output).toEqual(VALID);
	expect(calls).toHaveLength(0);
	recordExampleCases(stateMeta('accepts-an-idle-thread-without-reading-its-history'), [
		{ name: 'idle thread', input, output }
	]);
});

test('Accepts a system error whose last turn failed', async () => {
	const turns = [{ status: 'completed' }, { status: 'failed' }];
	const { rpc, calls } = recordingRpc({ turns });
	const output = await validator.validate(SYSTEM_ERROR, rpc);
	expect(output).toEqual(VALID);
	expect(calls).toEqual([
		{ method: 'thread/read', params: { threadId: THREAD_ID, includeTurns: true } }
	]);
	recordExampleCases(stateMeta('accepts-a-system-error-whose-last-turn-failed'), [
		{ name: 'last turn failed, no running turn', input: { statusType: 'systemError', turns }, output }
	]);
});

test('Rejects a system error that is not a confirmed failure', async () => {
	const cases = await Promise.all(
		UNCONFIRMED.map(async ({ name, turns }) => {
			const { rpc } = recordingRpc({ turns });
			const output = await validator.validate(SYSTEM_ERROR, rpc);
			expect(output).toEqual(INVALID);
			return { name, input: { statusType: 'systemError', turns }, output };
		})
	);
	recordExampleCases(stateMeta('rejects-a-system-error-that-is-not-a-confirmed-failure'), cases);
});

test('Rejects other status types without reading history', async () => {
	const { rpc, calls } = recordingRpc({});
	const input = { id: THREAD_ID, status: { type: 'notLoaded' } };
	const output = await validator.validate(input, rpc);
	expect(output).toEqual(INVALID);
	expect(calls).toHaveLength(0);
	recordExampleCases(stateMeta('rejects-other-status-types-without-reading-history'), [
		{ name: 'notLoaded status', input, output }
	]);
});

test('Rejects a missing input with a TypeError', async () => {
	const { rpc } = recordingRpc({});
	const error = await rejectionOf(() => validator.validate(null as unknown as PickerData, rpc));
	expect(error.name).toBe('TypeError');
	recordExampleCases(stateMeta('rejects-a-missing-input-with-a-typeerror'), [
		{ name: 'null input', input: null, error }
	]);
});

test('Propagates an RPC failure unchanged', async () => {
	const failingRpc: PickerRpc = () => Promise.reject(new Error('thread/read unavailable'));
	const error = await rejectionOf(() => validator.validate(SYSTEM_ERROR, failingRpc));
	expect(error).toEqual({ name: 'Error', message: 'thread/read unavailable' });
	recordExampleCases(stateMeta('propagates-an-rpc-failure-unchanged'), [
		{ name: 'rpc rejects on thread/read', input: SYSTEM_ERROR, error }
	]);
});
