import { spawnSync } from 'node:child_process';
import { expect } from 'vitest';

export function verifyNativeInvocations(
	codex: { cwd: string },
	claude: { cwd: string },
	{ dockerWorktree, client }: { dockerWorktree: string; client: { node: string; apiPort: number } }
) {
	const { node } = client;
	expect(codex).toMatchObject({
		argv: [
			'--dangerously-bypass-approvals-and-sandbox',
			'-m',
			'gpt-6.2-sol',
			'-c',
			'model_reasoning_effort="high"',
			expect.stringContaining('def123abc4')
		],
		image: null,
		user: null,
		secret: false,
		client: { node, apiPort: client.apiPort },
		legacy: '/dev/null/tracker',
		guestAuthFile: null
	});
	expect(claude).toMatchObject({
		argv: [
			'--dangerously-skip-permissions',
			'--remote-control',
			'Harness: Fixture',
			'--session-id',
			expect.stringMatching(/^[a-f0-9-]{36}$/),
			'--settings',
			'{"availableModels":["opus","sonnet","haiku"]}',
			'--model',
			'claude-sonnet-4-6',
			'--effort',
			'high',
			expect.stringContaining('def123abc4')
		],
		image: null,
		user: spawnSync('/usr/bin/id', ['-un'], { encoding: 'utf8' }).stdout.trim(),
		secret: false,
		client: { node, apiPort: client.apiPort },
		legacy: '/dev/null/tracker',
		guestAuthFile: null
	});
	expect(codex.cwd).not.toBe(dockerWorktree);
	expect(claude.cwd).not.toBe(codex.cwd);
}
