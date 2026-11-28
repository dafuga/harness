import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect } from 'vitest';

export function managedTrackerTools(root: string) {
	const tools = join(root, 'tools');
	mkdirSync(tools, { mode: 0o700 });
	const previous = join(root, 'previous-harness');
	writeFileSync(
		previous,
		`#!/bin/sh\nprintf '%s\\n' 'command is unavailable in native mode' >&2\nexit 1\n`,
		{ mode: 0o700 }
	);
	symlinkSync(previous, join(tools, 'harness'));
	symlinkSync(resolve('scripts/tracker-shim.sh'), join(tools, 'tracker'));
	return tools;
}

export function verifyTrackerCliUpgrade(tools: string, nativeProfile: string) {
	const { trackerExecutable } = JSON.parse(
		readFileSync(join(nativeProfile, 'invoked.ndjson'), 'utf8').trim()
	);
	const active = join(tools, 'active-harness');
	writeFileSync(
		active,
		`#!/bin/sh\n[ "$1" = tracker ] || exit 2\ncase "$2" in\nalert|host-work) printf '%s\\n' "$2 reached the active CLI";;\n*) exit 2;;\nesac\n`,
		{ mode: 0o700 }
	);
	const staged = join(tools, 'next-harness');
	symlinkSync(active, staged);
	renameSync(staged, join(tools, 'harness'));
	const commands = [
		['alert', 'def123abc4', 'Fixture'],
		['host-work', 'ssh', 'auto', '--', 'true']
	];
	const results = commands.map((args) => {
		const result = spawnSync(join(tools, 'tracker'), args, {
			env: { PATH: '/usr/bin:/bin', HOME: nativeProfile, HARNESS_EXECUTABLE: trackerExecutable },
			encoding: 'utf8'
		});
		return { stderr: result.stderr, stdout: result.stdout, status: result.status };
	});
	expect(results).toEqual([
		{ stderr: '', stdout: 'alert reached the active CLI\n', status: 0 },
		{ stderr: '', stdout: 'host-work reached the active CLI\n', status: 0 }
	]);
}

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
