import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { pickerMcpTools } from '../../src/utils/development-tooling/pickerMcpTools';
import { UnknownPickerOperationError } from '../../src/utils/development-tooling/pickerMcpTools.types';

type Service = Parameters<typeof pickerMcpTools>[0];
type Call = { member: string; args: unknown[] };

const switchInput = {
	session_id: 'session-4f2a',
	provider: 'harness-claude',
	model: 'claude-sonnet-5-5',
	effort: 'high'
};
const cancelInput = { session_id: 'session-4f2a', request_id: 'request-7b9d' };

function fakeService(calls: Call[]): Service {
	const record = (member: string, args: unknown[]) => {
		calls.push({ member, args });
	};
	const service = {
		catalog: {
			list: () => {
				record('catalog.list', []);
				return Promise.resolve([{ id: 'claude-sonnet-5-5' }]);
			}
		},
		store: {
			list: () => {
				record('store.list', []);
				return [{ session_id: 'session-4f2a' }];
			}
		},
		request: (...args: unknown[]) => {
			record('request', args);
			return Promise.resolve({ status: 'requested' });
		},
		cancel: (...args: unknown[]) => {
			record('cancel', args);
			return Promise.resolve({ status: 'cancelled' });
		},
		status: (...args: unknown[]) => {
			record('status', args);
			return Promise.resolve({ status: 'ready' });
		}
	};
	return service as unknown as Service;
}

test('Lists models and observed sessions from the service', async () => {
	const calls: Call[] = [];
	const service = fakeService(calls);
	const models = await pickerMcpTools(service, 'list_models', {});
	const sessions = await pickerMcpTools(service, 'list_observed_sessions', undefined);
	expect(models).toEqual({ models: [{ id: 'claude-sonnet-5-5' }] });
	expect(sessions).toEqual({ sessions: [{ session_id: 'session-4f2a' }] });
	expect(calls).toEqual([
		{ member: 'catalog.list', args: [] },
		{ member: 'store.list', args: [] }
	]);
	recordExampleCases(
		{
			unitId: 'function.picker-mcp-tools',
			symbol: 'pickerMcpTools',
			state: 'lists-models-and-observed-sessions-from-the-service',
			evidence: 'examples-cases',
			file: 'lists-models-and-observed-sessions-from-the-service.json'
		},
		[
			{ name: 'list_models returns the catalog', input: { name: 'list_models' }, output: models },
			{
				name: 'list_observed_sessions returns the store',
				input: { name: 'list_observed_sessions' },
				output: sessions
			}
		]
	);
});

test('Routes switch and cancel requests with their arguments', async () => {
	const calls: Call[] = [];
	const service = fakeService(calls);
	const switched = await pickerMcpTools(service, 'request_model_switch', switchInput);
	const cancelled = await pickerMcpTools(service, 'cancel_model_switch', cancelInput);
	expect(calls).toEqual([
		{
			member: 'request',
			args: [
				'session-4f2a',
				{ provider: 'harness-claude', model: 'claude-sonnet-5-5', effort: 'high' }
			]
		},
		{ member: 'cancel', args: ['session-4f2a', 'request-7b9d'] }
	]);
	expect(switched).toEqual({ status: 'requested' });
	expect(cancelled).toEqual({ status: 'cancelled' });
	recordExampleCases(
		{
			unitId: 'function.picker-mcp-tools',
			symbol: 'pickerMcpTools',
			state: 'routes-switch-and-cancel-requests-with-their-arguments',
			evidence: 'examples-cases',
			file: 'routes-switch-and-cancel-requests-with-their-arguments.json'
		},
		[
			{
				name: 'request_model_switch forwards session and switch details',
				input: { name: 'request_model_switch', input: switchInput },
				output: switched
			},
			{
				name: 'cancel_model_switch forwards session and request ids',
				input: { name: 'cancel_model_switch', input: cancelInput },
				output: cancelled
			}
		]
	);
});

test('Opens the picker with a null session when none is given', async () => {
	const calls: Call[] = [];
	const service = fakeService(calls);
	const open = await pickerMcpTools(service, 'open_model_picker', {});
	const provider = await pickerMcpTools(service, 'get_provider_status', {
		session_id: 'session-4f2a'
	});
	expect(calls).toEqual([
		{ member: 'status', args: [null] },
		{ member: 'status', args: ['session-4f2a'] }
	]);
	expect(open).toEqual({ status: 'ready' });
	expect(provider).toEqual({ status: 'ready' });
	recordExampleCases(
		{
			unitId: 'function.picker-mcp-tools',
			symbol: 'pickerMcpTools',
			state: 'opens-the-picker-with-a-null-session-when-none-is-given',
			evidence: 'examples-cases',
			file: 'opens-the-picker-with-a-null-session-when-none-is-given.json'
		},
		[
			{
				name: 'open_model_picker without session_id asks status for null',
				input: { name: 'open_model_picker', input: {} },
				output: open
			},
			{
				name: 'get_provider_status with session_id asks status for it',
				input: { name: 'get_provider_status', input: { session_id: 'session-4f2a' } },
				output: provider
			}
		]
	);
});

test('Rejects unknown operations and invalid switch arguments', async () => {
	const calls: Call[] = [];
	const service = fakeService(calls);
	const unknown = pickerMcpTools(service, 'delete_session', {});
	const invalid = pickerMcpTools(service, 'request_model_switch', {
		...switchInput,
		provider: 'other-provider'
	});
	await expect(unknown).rejects.toBeInstanceOf(UnknownPickerOperationError);
	await expect(unknown).rejects.toThrow('Unknown picker operation.');
	await expect(invalid).rejects.toMatchObject({ name: 'ZodError' });
	expect(calls).toEqual([]);
	recordExampleCases(
		{
			unitId: 'function.picker-mcp-tools',
			symbol: 'pickerMcpTools',
			state: 'rejects-unknown-operations-and-invalid-switch-arguments',
			evidence: 'examples-cases',
			file: 'rejects-unknown-operations-and-invalid-switch-arguments.json'
		},
		[
			{
				name: 'unknown operation name is rejected before any service call',
				input: { name: 'delete_session', input: {} },
				error: 'Unknown picker operation.'
			},
			{
				name: 'provider outside openai or harness-claude is rejected',
				input: { name: 'request_model_switch', input: { ...switchInput, provider: 'other-provider' } },
				error: 'ZodError'
			}
		]
	);
});
