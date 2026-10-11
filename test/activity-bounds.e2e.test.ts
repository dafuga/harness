import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { runHarness } from './support/cli';

/**
 * A large change and a busy checkout are told with bounds: a count and the first few names, a
 * flag where a list was cut, and for a working agent the moment its own allowance runs out, so
 * that a page can stop calling it working without asking again.
 */
interface Shown {
	activity: { work: Array<{ units: string[]; unitCount: number; files: number }> };
	live: {
		worktrees: Array<{ changes: unknown[]; truncated: boolean }>;
		agents: { roster: Array<{ label: string; heartbeatAt: string; expiresAt: string }> };
	};
}
let root: string;
const git = (args: string[]) =>
	execFileSync(
		'git',
		['-c', 'user.name=Fixture', '-c', 'user.email=fixture@harness.invalid', ...args],
		{
			cwd: root,
			encoding: 'utf8'
		}
	);
const harness = (args: string[]) => runHarness(args, root);

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), 'harness-activity-bounds-'));
	mkdirSync(join(root, 'src/utils'), { recursive: true });
	for (let index = 0; index < 30; index += 1) {
		const source = `export function part${index}(n: number): number {\n\treturn n + ${index};\n}\n`;
		writeFileSync(join(root, `src/utils/part${index}.ts`), source);
	}
	writeFileSync(join(root, '.gitignore'), '.cache/\n');
	git(['init', '-q', '-b', 'main']);
	await harness(['units', 'index', '--write']);
	git(['add', '-A']);
	git(['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'feat: thirty parts at once']);
	for (let index = 0; index < 45; index += 1) writeFileSync(join(root, `draft-${index}.txt`), 'x');
}, 120_000);
afterAll(() => rm(root, { recursive: true, force: true }));

test('a commit of many components is a count and its first twelve; a long list of changes says it was cut', async () => {
	const shown = JSON.parse((await harness(['activity', 'show', '--json'])).stdout) as Shown;
	const [large] = shown.activity.work;
	expect([large.unitCount, large.units.length]).toEqual([30, 12]);
	expect(large.files).toBeGreaterThanOrEqual(60);
	const [checkout] = shown.live.worktrees;
	expect([checkout.changes.length, checkout.truncated]).toEqual([40, true]);
});

test('a working agent carries the moment its allowance ends', async () => {
	await harness(['activity', 'register', '--label', 'Timed', '--ttl', '120']);
	const shown = JSON.parse((await harness(['activity', 'show', '--json'])).stdout) as Shown;
	const [agent] = shown.live.agents.roster;
	expect(Date.parse(agent.expiresAt) - Date.parse(agent.heartbeatAt)).toBe(120_000);
});
