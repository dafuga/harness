import { expect, test, vi } from 'vitest';
import { CodexSessionRepository } from '../../src/repositories/CodexSessionRepository';
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
	query: () => ({
		[Symbol.asyncIterator]: () => ({
			next: () => Promise.reject(new Error('private process detail'))
		})
	}),
	createSdkMcpServer: () => ({ type: 'sdk' })
}));
import { ClaudeQueryService } from '../../src/services/ClaudeQueryService';
test('process failure is sanitized, ends running state and has no paid fallback', async () => {
	const repository = new CodexSessionRepository();
	const session = repository.create('thread');
	session.emit = vi.fn();
	await new ClaudeQueryService(repository).run(
		{ model: 'claude-opus-5-5', stream: true, tools: [], input: [] },
		session
	);
	expect(session.running).toBe(false);
	expect(session.emit).toHaveBeenCalledWith({
		type: 'error',
		message: 'Claude query failed; no fallback was used'
	});
});
