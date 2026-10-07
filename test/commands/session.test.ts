import { expect, test, vi, afterEach, beforeEach } from 'vitest';
import { mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { parseSessionEvent, readSessionCredential } from '../../src/workflows/sessionHookConfig';
import { sessionProject } from '../../src/workflows/sessionProject';
import { runSessionHook } from '../../src/workflows/runSessionHook';
import { JevAdapter } from '../../src/adapters/JevAdapter';
import {
	reviewFixtureRoot,
	fixtureEvaluation,
	writeReviewFixture
} from '../support/cleanCodeFixture';
import type { JevRequest } from '../../src/core/jevTypes';

const fixtures: string[] = [];

beforeEach(() => {
	vi.stubEnv('HARNESS_ANALYTICS_DISABLED', '1');
});

afterEach(async () => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	await Promise.all(fixtures.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test('accepts startup and resume without using transcript or assistant content', () => {
	for (const source of ['startup', 'resume', 'clear']) {
		const event = {
			hook_event_name: 'SessionStart',
			session_id: 'session-1',
			cwd: '/tmp/project',
			source
		};
		expect(parseSessionEvent(JSON.stringify(event))).toEqual(event);
	}
});

test('skips unsupported events and rejects relative project paths', () => {
	const event = {
		hook_event_name: 'SessionStart',
		session_id: 'session-1',
		cwd: '/tmp/project',
		source: 'startup'
	};
	expect(parseSessionEvent(JSON.stringify({ ...event, source: 'compact' }))).toBeUndefined();
	expect(parseSessionEvent(JSON.stringify({ ...event, hook_event_name: 'Stop' }))).toBeUndefined();
	expect(parseSessionEvent(JSON.stringify({ ...event, cwd: '../project' }))).toBeUndefined();
});

test('rejects malformed and oversized hook input', () => {
	expect(() => parseSessionEvent('{')).toThrow();
	expect(() => parseSessionEvent(' '.repeat(32001))).toThrow('too large');
});

test('ignores transcript and assistant message fields', () => {
	const event = {
		hook_event_name: 'SessionStart',
		session_id: 'session-1',
		cwd: '/tmp/project',
		source: 'startup'
	};
	expect(
		parseSessionEvent(
			JSON.stringify({
				...event,
				transcript_path: '/private/session',
				last_assistant_message: 'private text'
			})
		)
	).toEqual(event);
});

test('reads only the checker credential and sanitizes malformed secret values', async () => {
	const root = await fixture();
	const credential = join(root, '.env');
	await writeFile(credential, 'UNRELATED_KEY=never-use\nHARNESS_JEV_API_KEY="fixture-checker"\n', {
		mode: 0o600
	});
	expect(await readSessionCredential(credential)).toBe('fixture-checker');
	await writeFile(credential, 'HARNESS_JEV_API_KEY="fixture-checker" trailing-secret');
	await expect(readSessionCredential(credential)).rejects.toThrow('invalid quoted value');
});

test('provider failure stops further requests and never becomes a clean verdict', async () => {
	const root = await fixture();
	await writeReviewFixture(root, 'src/utils/other.ts', 'export const other = true;');
	const options = await hookOptions(root);
	const evaluate = vi
		.spyOn(JevAdapter.prototype, 'evaluate')
		.mockRejectedValue(new Error('provider failure'));
	const result = await runSessionHook(hookEvent(root), options);
	expect(evaluate).toHaveBeenCalledTimes(1);
	expect(result.hookSpecificOutput?.additionalContext).toContain('Jev Clean Code: incomplete');
});

test('project credential overrides cannot redirect the checker to an unrelated secret', async () => {
	const root = await fixture();
	const options = await hookOptions(root);
	await writeFile(
		join(root, 'harness.audit.json'),
		JSON.stringify({ cleanCode: { apiKeyEnv: 'UNRELATED_KEY' } })
	);
	vi.stubEnv('UNRELATED_KEY', 'never-use');
	const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
		expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer fixture-checker');
		return Response.json(fixtureEvaluation(JSON.parse(String(init?.body)) as JevRequest));
	});
	try {
		const result = await runSessionHook(hookEvent(root), options);
		expect(result.hookSpecificOutput?.additionalContext).toContain('Jev Clean Code: clean');
		expect(fetch).toHaveBeenCalled();
	} finally {
		vi.unstubAllEnvs();
	}
});

test('allows an associated Git worktree while rejecting an unrelated project', async () => {
	const root = await fixture();
	const worktree = join(root, 'worktree');
	git(root, ['init']);
	git(root, ['add', 'src']);
	git(root, [
		'-c',
		'user.name=Fixture',
		'-c',
		'user.email=fixture@example.invalid',
		'-c',
		'commit.gpgsign=false',
		'-c',
		'core.hooksPath=/dev/null',
		'commit',
		'-m',
		'fixture'
	]);
	git(root, ['worktree', 'add', '--detach', worktree]);
	await writeFile(join(worktree, 'harness.audit.json'), '{}');
	expect(await sessionProject(worktree, [root])).toBe(await realpath(worktree));
	const unrelated = join(root, 'unrelated');
	await mkdir(unrelated);
	git(unrelated, ['init']);
	await writeFile(join(unrelated, 'harness.audit.json'), '{}');
	expect(await sessionProject(unrelated, [worktree])).toBeUndefined();
});

async function fixture(): Promise<string> {
	const root = await reviewFixtureRoot();
	fixtures.push(root);
	return root;
}

async function hookOptions(root: string): Promise<{ settings: string }> {
	const credentialFile = join(root, '.env');
	await writeFile(credentialFile, 'HARNESS_JEV_API_KEY="fixture-checker"\n', { mode: 0o600 });
	await writeFile(join(root, 'harness.audit.json'), '{}');
	const settings = join(root, 'settings.json');
	await writeFile(settings, JSON.stringify({ roots: [root], credentialFile }));
	return { settings };
}

function hookEvent(cwd: string): string {
	return JSON.stringify({
		hook_event_name: 'SessionStart',
		source: 'startup',
		cwd,
		session_id: 'fixture'
	});
}

function git(cwd: string, args: string[]): void {
	const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
	if (result.status) throw new Error(result.stderr);
}
