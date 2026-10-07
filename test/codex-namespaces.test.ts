import { expect, test } from 'vitest';
import { CodexResponsesSerializer } from '../src/serializers/CodexResponsesSerializer';
test('Responses tool call preserves namespace for Codex execution', () => {
	const serializer = new CodexResponsesSerializer('claude-opus-5-5');
	const events = serializer.call({
		id: 'namespaced-call',
		name: 'read',
		namespace: 'mcp__fixture',
		arguments: '{}',
		custom: false
	});
	expect(events.at(-1)?.item).toMatchObject({
		type: 'function_call',
		name: 'read',
		namespace: 'mcp__fixture',
		call_id: 'namespaced-call'
	});
});
