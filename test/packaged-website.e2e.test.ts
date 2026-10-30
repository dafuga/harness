import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	listening,
	packedInstall,
	running,
	withReportServer,
	type PackedInstall,
	type ServedReports
} from './support/packedReports';

let install: PackedInstall;
beforeAll(async () => {
	install = await packedInstall();
}, 120_000);
afterAll(() => install?.dispose());

test('a packed installation serves the explorer without a source checkout', async () => {
	await withReportServer(install, async (server) => {
		expect((await fetch(`${server.url}/api/health`)).status).toBe(200);
		const old = await fetch(`${server.url}/analytics`, { redirect: 'manual' });
		expect([old.status, old.headers.get('location')]).toEqual([308, '/harness']);
		const opened = await fetch(`${server.url}/analytics`);
		expect([opened.status, new URL(opened.url).pathname]).toEqual([200, '/harness']);
		expect(await opened.text()).toContain('aria-label="Harness categories"');
	});
}, 120_000);

test('the server a test starts is stopped when the test is done with it, passed or failed', async () => {
	const seen: ServedReports[] = [];
	await withReportServer(install, async (server) => {
		seen.push(server);
		expect([await listening(server.url), running(server.pid)]).toEqual([true, true]);
	});
	const failure = withReportServer(install, async (server) => {
		seen.push(server);
		expect(await listening(server.url)).toBe(true);
		throw new Error('an assertion of the test failed');
	});
	await expect(failure).rejects.toThrow('an assertion of the test failed');
	expect(seen).toHaveLength(2);
	for (const server of seen) {
		expect([server.port, await listening(server.url), running(server.pid)]).toEqual([
			server.port,
			false,
			false
		]);
	}
	// Stopping again finds nothing of this store to stop, and stops nothing else.
	const again = await install.run(['report', 'stop', '--port', String(seen[0].port)]);
	expect(JSON.parse(again.stdout)).toMatchObject({ port: seen[0].port, stopped: false });
}, 120_000);

test('the fixture and the environment of the run are gone with it', async () => {
	const { root } = install;
	expect(process.env.PROJECT_REPORTS_HOME).toBe(join(root, 'store'));
	await install.dispose();
	expect(existsSync(root)).toBe(false);
	expect(process.env.PROJECT_REPORTS_HOME).not.toBe(join(root, 'store'));
});
