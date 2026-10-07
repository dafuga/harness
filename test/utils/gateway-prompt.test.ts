import { expect, test } from 'vitest';
import { gatewayPrompt } from '../../src/utils/gatewayPrompt';
test('replayed history retains role labels and tool call correlation', () => {
	const input = [
		{ role: 'user', content: 'remember alpha' },
		{ type: 'function_call_output', call_id: 'call-a', output: 'alpha' }
	];
	const prompt = gatewayPrompt({ model: 'claude-opus-5-5', stream: true, tools: [], input });
	expect(prompt).toContain(JSON.stringify(input));
});
