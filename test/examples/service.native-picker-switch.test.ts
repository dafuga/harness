import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { NativePickerSwitchService } from '../../src/services/development-tooling/native-picker-bridge-service/NativePickerSwitchService';

function makeRpc() {
	const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
	const rpc = async (method: string, params: Record<string, unknown>) => {
		calls.push({ method, params });
		if (method === 'thread/read') {
			const switching = calls.some((call) => call.method === 'thread/resume');
			return {
				thread: switching
					? {
							id: 'thread-123', cwd: '/workspace/project', model: 'gpt-5',
							modelProvider: 'openai', reasoningEffort: 'high', status: { type: 'idle' }
						}
					: {
							id: 'thread-123', cwd: '/workspace/project', model: 'gpt-4.1',
							modelProvider: 'openai', reasoningEffort: 'medium', status: { type: 'idle' }
						}
			};
		}
		if (method === 'remoteControl/status/read') return { status: 'disabled' };
		if (method === 'thread/loaded/list') return { data: [] };
		if (method === 'thread/resume') return { id: 'thread-123', resumed: true };
		return {};
	};
	return { rpc, calls };
}

test('Switches an idle persisted chat to the selected provider', async () => {
	await withTempDir('native-picker-switch-', async (directory) => {
		const { rpc, calls } = makeRpc();
		const service = new NativePickerSwitchService(rpc, { timeoutMs: 100, catalogPath: `${directory}/catalog.json` });
		const input = { threadId: 'thread-123', model: 'gpt-5', effort: 'high' };
		const output = await service.apply(input, { source: 'example', config: {} });
		expect(output).toEqual({ id: 'thread-123', resumed: true });
		expect(calls.some((call) => call.method === 'thread/resume' && call.params.model === 'gpt-5')).toBe(true);
		recordExampleCases(
			{
				unitId: 'service.native-picker-switch',
				symbol: 'NativePickerSwitchService.apply',
				state: 'switches-an-idle-persisted-chat-to-the-selected-provider',
				evidence: 'examples-cases',
				file: 'switches-an-idle-persisted-chat-to-the-selected-provider.json'
			},
			[
				{
					name: 'idle persisted thread resumes with selected model and effort',
					input: { params: input, context: { source: 'example', config: {} } },
					output: { id: 'thread-123', resumed: true }
				}
			]
		);
	});
});
