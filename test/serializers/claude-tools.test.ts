import { expect, test } from 'vitest';
import { ClaudeToolsSerializer } from '../../src/serializers/ClaudeToolsSerializer';
import { CodexSessionRepository } from '../../src/repositories/CodexSessionRepository';
test('unsupported execution tools fail closed', () => {
	const repository = new CodexSessionRepository();
	expect(() =>
		new ClaudeToolsSerializer(repository).server(
			[{ type: 'computer' }],
			repository.create('thread')
		)
	).toThrow('Unsupported');
});
