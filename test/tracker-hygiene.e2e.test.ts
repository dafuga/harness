import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { openHygieneBrowserFixture } from './support/trackerHygieneBrowserFixture';
import { withTempDir } from './support/temporary';
import { hygieneFixture, findHygieneTmux } from './support/trackerHygieneFixture';

const tmux = findHygieneTmux();
const scenarios = ['exit', 'stop', 'timeout'] as const;

test('the CLI installs exactly the built-in documents into both assistant profiles', async () => {
	await withTempDir('harness-hygiene-skills-', async (home) => {
		const env = {
			...process.env,
			HOME: home,
			CODEX_HOME: join(home, '.codex'),
			CLAUDE_CONFIG_DIR: join(home, '.claude')
		};
		execFileSync('bun', ['src/cli/index.ts', 'hygiene', 'install-skills'], { env, timeout: 10000 });
		for (const name of ['computer-hygiene', 'design-patterns']) {
			const source = readFileSync(resolve('.codex', 'skills', name, 'SKILL.md'), 'utf8');
			for (const profile of ['.codex', '.claude']) {
				expect(readFileSync(join(home, profile, 'skills', name, 'SKILL.md'), 'utf8')).toBe(source);
			}
		}
	});
});

test(
	'browser cleanup closes only targets created by the run in its test-launched browser',
	{ timeout: 30_000 },
	() =>
		withTempDir('harness-hygiene-browser-', async (root) => {
			mkdirSync(join(root, 'ledger'), { mode: 0o700 });
			const browser = await openHygieneBrowserFixture(root);
			try {
				const control = await browser.control.newPage();
				await control.goto('about:blank#independent-control');
				const tab = browser.hygiene('tab');
				const window = browser.hygiene('window');
				const targetIds = async () => (await browser.targets()).map(({ id }) => id);
				expect(await targetIds()).toEqual(expect.arrayContaining([tab.target, window.target]));
				browser.hygiene('close', tab.resource);
				browser.hygiene('close', window.resource);
				expect(await targetIds()).not.toEqual(expect.arrayContaining([tab.target]));
				expect(await targetIds()).not.toEqual(expect.arrayContaining([window.target]));
				expect(control.url()).toBe('about:blank#independent-control');
				expect(control.isClosed()).toBe(false);
			} finally {
				await browser.control.close();
			}
		})
);

test.skipIf(!tmux).each(scenarios)(
	'managed worker %s reaps only its recorded process group',
	{ timeout: 90_000 },
	(reason) =>
		withTempDir('harness-hygiene-run-', async (root) => {
			const fixture = hygieneFixture(root, tmux!);
			const unrelated = spawn('/bin/sleep', ['90']);
			try {
				fixture.start();
				await expect
					.poll(() => existsSync(join(root, 'owned-pid')), { timeout: 15_000 })
					.toBe(true);
				const pid = Number(readFileSync(join(root, 'owned-pid'), 'utf8'));
				expect(fixture.processAlive(pid)).toBe(true);
				if (reason === 'exit') mkdirSync(join(root, 'release'));
				if (reason === 'stop') fixture.stop();
				await expect.poll(fixture.report, { timeout: 75_000 }).toEqual({ remaining: [] });
				expect(fixture.processAlive(pid)).toBe(false);
				await expect.poll(fixture.hasSession).toBe(false);
				expect(fixture.processAlive(unrelated.pid!)).toBe(true);
			} finally {
				if (fixture.hasSession()) fixture.stop();
				await fixture.waitForCleanup();
				unrelated.kill();
			}
		})
);
