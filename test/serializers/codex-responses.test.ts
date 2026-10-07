import { expect, test } from 'vitest';
import { CodexResponsesSerializer } from '../../src/serializers/CodexResponsesSerializer';

test('Responses stream exposes incremental text and correlated function calls', () => {
	const serializer = new CodexResponsesSerializer('claude-opus-5-5');
	const events = [
		serializer.start(),
		serializer.text('hello'),
		serializer.text(' world'),
		serializer.call({
			id: 'call-test',
			name: 'read_file',
			arguments: '{"path":"README.md"}',
			custom: false
		}),
		serializer.finish()
	].flat();
	expect(
		events.some((event) => event.type === 'response.output_text.delta' && event.delta === 'hello')
	).toBe(true);
	const final = events.find((event) => event.type === 'response.completed');
	expect(final?.response).toMatchObject({
		status: 'completed',
		output: [
			{ type: 'message', content: [{ type: 'output_text', text: 'hello world' }] },
			{
				type: 'function_call',
				call_id: 'call-test',
				name: 'read_file',
				arguments: '{"path":"README.md"}'
			}
		]
	});
});
