import { chmodSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, onTestFinished, test, vi } from 'vitest';
import { createTempDirectory } from '../../support/temporary';
import { TrackerCommand } from '../../../src/commands/projects-sessions/TrackerCommand';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';

const start = '<!-- tracker:start -->';
const end = '<!-- tracker:end -->';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

async function instructionsFixture() {
	const home = await createTempDirectory('tracker-instructions-');
	onTestFinished(() => rmSync(home, { recursive: true, force: true }));
	// A config that cannot be read proves the command needs neither it nor the service.
	vi.stubEnv('HARNESS_TRACKER_CONFIG', join(home, 'absent.json'));
	vi.stubEnv('HOME', home);
	const log = vi.spyOn(console, 'log').mockImplementation(() => {});
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	const run = async (...args: string[]) => {
		log.mockClear();
		error.mockClear();
		const code = await new TrackerCommand().run(['instructions', ...args]);
		const text = (spy: typeof log) => spy.mock.calls.map(([line]) => String(line)).join('\n');
		return { code, out: text(log), err: text(error) };
	};
	return { home, run };
}

const count = (text: string, part: string) => text.split(part).length - 1;

test('instructions writes one canonical block into both default agent files', async () => {
	const { home, run } = await instructionsFixture();
	const files = [join(home, '.claude', 'CLAUDE.md'), join(home, '.codex', 'AGENTS.md')];
	const check = await run('--check');
	expect(check.code).toBe(1);
	expect(count(check.out, 'would update')).toBe(2);
	expect(() => statSync(files[0])).toThrow();
	const written = await run();
	expect(written).toMatchObject({ code: 0, err: '' });
	expect(count(written.out, 'created')).toBeGreaterThanOrEqual(2);
	for (const file of files) expect(count(readFileSync(file, 'utf8'), start)).toBe(1);
	const current = await run('--check', '--json');
	expect(current.code).toBe(0);
	expect(JSON.parse(current.out)).toMatchObject([{ status: 'current' }, { status: 'current' }]);
});

test('instructions repairs damaged and duplicate blocks without losing other text', async () => {
	const { home, run } = await instructionsFixture();
	const orphan = join(home, 'orphan.md');
	writeFileSync(orphan, `before\r\n${start}\r\nafter $& $1\r\n`);
	chmodSync(orphan, 0o600);
	const doubled = join(home, 'doubled.md');
	writeFileSync(doubled, `top\n${start}\nold one\n${end}\nmiddle\n${start}\nold\n${end}\ntail\n`);
	const stray = join(home, 'stray.md');
	writeFileSync(stray, `keep\n${end}\n`);
	const repaired = await run(orphan, doubled, stray);
	expect(repaired.code).toBe(0);
	expect(repaired.out).toContain('removed a stray start marker');
	expect(repaired.out).toContain('collapsed 2 blocks into one');
	for (const [file, kept] of [
		[orphan, ['before', 'after $& $1']],
		[doubled, ['top', 'middle', 'tail']],
		[stray, ['keep']]
	] as const) {
		const text = readFileSync(file, 'utf8');
		expect(count(text, start)).toBe(1);
		expect(count(text, end)).toBe(1);
		for (const line of kept) expect(text).toContain(line);
		expect(text).not.toContain('old');
	}
	expect(readFileSync(orphan, 'utf8').indexOf(start)).toBeLessThan(
		readFileSync(orphan, 'utf8').indexOf('after')
	);
	expect(statSync(orphan).mode & 0o777).toBe(0o600);
	expect((await run('--check', orphan, doubled, stray)).code).toBe(0);
});

test('every command named in the canonical block exists natively', async () => {
	const { home, run } = await instructionsFixture();
	const file = join(home, 'block.md');
	await run(file);
	const text = readFileSync(file, 'utf8');
	const named = [...text.matchAll(/`tracker ([a-z][a-z-]*)/g)].map(([, verb]) => verb);
	expect(named).toEqual(expect.arrayContaining(['start', 'flag', 'check', 'done']));
	for (const verb of named) {
		if (verb === 'help') continue;
		let message = '';
		try {
			nativeTrackerArgs([verb]);
		} catch (error) {
			message = String(error);
		}
		expect(message, verb).not.toContain('unavailable in native mode');
	}
	expect(text).toContain('--recommend');
	expect(text).toContain('plain English');
	expect(text).toContain('what you want to do and why in one sentence');
	expect(text).toContain('tool or process questions to Chief of Staff');
});

test('instructions rejects unknown options', async () => {
	const { run } = await instructionsFixture();
	expect(await run('--force')).toMatchObject({ code: 1, out: '' });
});
