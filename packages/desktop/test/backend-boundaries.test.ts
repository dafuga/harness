import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { IpcRequestValidator } from '../src/validators/IpcRequestValidator';
import { NavigationValidator } from '../src/validators/NavigationValidator';
import { scrubEnvironment } from '../src/utils/scrubEnvironment';
import { publicCliEvents } from '../src/utils/publicCliEvents';

test('remote pages and child frames cannot use the project bridge', () => {
	const gate = new NavigationValidator();
	expect(gate.validate('harness://app/harness')).toBe(true);
	expect(gate.validate('https://example.com')).toBe(false);
	expect(gate.validate('harness://evil/harness')).toBe(false);
	expect(gate.validate('file:///tmp/unknown.html')).toBe(false);
});

test('IPC refuses unknown operations, invalid regions and unapproved changes', () => {
	const gate = new IpcRequestValidator();
	expect(
		gate.parse('plan:create', { category: 'pages', title: 'Activity', goal: 'Show work' })
	).toEqual({ category: 'pages', title: 'Activity', goal: 'Show work' });
	expect(() => gate.parse('shell:run', { command: 'echo hi' })).toThrow();
	expect(() =>
		gate.parse('thread:open', {
			entityId: 'page.activity',
			version: 'v001',
			imageSha256: 'a'.repeat(64),
			state: 'default',
			viewport: 'desktop',
			region: { x: 0.9, y: 0, width: 0.5, height: 1 }
		})
	).toThrow();
	expect(() =>
		gate.parse('run:start', {
			mode: 'change',
			provider: 'codex',
			model: 'gpt-6-astra',
			effort: 'medium',
			entityId: 'page.activity',
			threadId: 'draft',
			text: 'Implement this',
			approval: null
		})
	).toThrow();
});

test('subscription subprocesses omit API overrides without changing the parent', () => {
	const env = { PATH: '/bin', OPENAI_API_KEY: 'synthetic', ANTHROPIC_BASE_URL: 'synthetic' };
	expect(scrubEnvironment(env)).toEqual({ PATH: '/bin' });
	expect(env.OPENAI_API_KEY).toBe('synthetic');
});

test('private reasoning is never forwarded to the renderer', () => {
	expect(publicCliEvents({ type: 'reasoning', text: 'PRIVATE' })).toEqual([]);
	expect(
		publicCliEvents({
			type: 'assistant',
			message: {
				content: [
					{ type: 'thinking', thinking: 'PRIVATE' },
					{ type: 'text', text: 'Design is ready.' }
				]
			}
		})
	).toEqual(['Design is ready.']);
});
