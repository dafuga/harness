import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import {
	containerBrowserArgs,
	containerBrowserName
} from '../src/adapters/execution-runtimes/container-browser-adapter/containerBrowserArgs';
import { dockerHost } from '../src/adapters/execution-runtimes/container-browser-adapter/dockerHost';
import { withTempDir } from './support/temporary';

const exec = promisify(execFile);
const live = process.env.HARNESS_TEST_CONTAINER_BROWSER === '1';

/**
 * Opt-in: needs the image from `harness container-browser setup`. It runs under Bun, as installed,
 * against a real container with its own throwaway profile.
 */
test.skipIf(!live)(
	'a real container browser is read over docker exec and publishes no port',
	{ timeout: 180_000 },
	async () => {
		const script = resolve(import.meta.dirname, 'support/containerBrowserLive.ts');
		const child = exec('bun', [script], { timeout: 170_000 });
		const { stdout } = await child;
		if (child.child.exitCode === null) await once(child.child, 'exit');
		expect(JSON.parse(stdout.trim().split('\n').at(-1)!)).toEqual({
			published: '',
			screen: 'RFB 003.008',
			webdriver: false,
			headless: false,
			posts: [{ id: '12345', author: 'fixture', text: 'Hello from a fixture', likes: 1204 }],
			tab: 'clicked'
		});
	}
);

test.skipIf(!process.env.HARNESS_TEST_PROTECTED_CHROME_SOCKET)(
	'stock Chrome keeps a website session across container recreation without DevTools',
	{ timeout: 180_000 },
	async () => {
		await exec('python3', [
			resolve(import.meta.dirname, 'support/protectedChromeExecutor.py'),
			resolve(import.meta.dirname, '../deploy/container-browser/protected-chrome-executor.py')
		]);
		await withTempDir('protected-chrome-', async (config) => {
			const socket = process.env.HARNESS_TEST_PROTECTED_CHROME_SOCKET!;
			const docker = dockerHost({ socket, config }).docker;
			const profile = `chrome-test-${randomBytes(6).toString('hex')}`;
			const name = containerBrowserName(profile);
			const seccomp = resolve(import.meta.dirname, '../deploy/vault/seccomp.json');
			const args = containerBrowserArgs({ profile }, seccomp).slice(0, -1);
			const start = () => docker([...args, '--network=none', 'harness-protected-chrome:test']);
			const inside = (...command: string[]) => docker(['exec', name, ...command], 5000);
			try {
				await start();
				expect(await docker(['port', name])).toBe('');
				expect(await inside('dpkg-query', '-W', '-f=${Package}', 'google-chrome-stable')).toBe(
					'google-chrome-stable'
				);
				expect(await waitForChrome(inside)).toBe('RFB 003.008');
				await expect(inside('socat', '-T1', 'STDIO', 'TCP:127.0.0.1:9222')).rejects.toThrow(
					/connection refused/iu
				);
				await expect(chromeSessionFixture(docker, name, 'enroll')).resolves.toBe(
					'reauth-required\nready'
				);
				await docker(['stop', '--time=30', name], 60_000);
				await docker(['rm', name]);
				await start();
				expect(await waitForChrome(inside)).toBe('RFB 003.008');
				await expect(chromeSessionFixture(docker, name, 'restart')).resolves.toBe(
					'ready\nreauth-required\nunknown'
				);
			} finally {
				await docker(['rm', '-f', name]).catch(() => '');
				await docker(['volume', 'rm', `${name}-profile`]).catch(() => '');
			}
		});
	}
);

async function chromeSessionFixture(
	docker: ReturnType<typeof dockerHost>['docker'],
	name: string,
	phase: 'enroll' | 'restart'
): Promise<string> {
	const fixture = resolve(import.meta.dirname, 'support/protectedChromeSession.py');
	await docker(['cp', fixture, `${name}:/tmp/protectedChromeSession.py`]);
	return docker(['exec', name, 'python3', '/tmp/protectedChromeSession.py', phase], 65_000);
}

async function waitForChrome(inside: (...command: string[]) => Promise<string>): Promise<string> {
	const readScreen =
		'lock=$(readlink /profile/google-chrome/SingletonLock) && ' +
		'test "$(cat "/proc/${lock##*-}/comm")" = chrome && ' +
		'xprop -root _NET_CLIENT_LIST | grep -q "window id # 0x" || exit 1';
	for (let attempt = 0; attempt < 40; attempt++) {
		const version = await inside(
			'bash',
			'-c',
			`${readScreen}; socat -T1 -u TCP:127.0.0.1:5900 STDOUT | head -c 12`
		).catch(() => '');
		if (version) return version;
		await new Promise((done) => setTimeout(done, 500));
	}
	throw new Error('Stock Chrome did not start on the virtual display.');
}
