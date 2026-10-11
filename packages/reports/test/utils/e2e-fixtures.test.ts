import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import {
	closeE2eRun,
	e2eFixtures,
	freePorts,
	namedE2eRun,
	openE2eRun
} from '../../src/utils/e2eFixtures';

const made: string[] = [];
afterEach(() => {
	for (const directory of made.splice(0)) rmSync(directory, { recursive: true, force: true });
});

test('a process outside any run is told so instead of sharing a default directory', () => {
	expect(() => e2eFixtures({})).toThrow('HARNESS_E2E_ROOT is not set');
});

test('two runs that name nothing get different directories and ports, and each removes only its own', () => {
	const [first, second]: Array<Record<string, string | undefined>> = [{}, {}];
	const [mine, theirs] = [openE2eRun(first), openE2eRun(second)];
	made.push(mine.root, theirs.root);
	expect(mine.root).not.toBe(theirs.root);
	expect([mine.reports, mine.console, mine.site('alpha-project')]).toEqual([
		join(mine.root, 'reports'),
		join(mine.root, 'console'),
		join(mine.root, 'sites/alpha-project')
	]);
	const ports = [first, second].flatMap((env) =>
		Object.entries(env).flatMap(([name, value]) => (name.endsWith('_PORT') ? [value] : []))
	);
	expect(ports).toHaveLength(10);
	expect(new Set(ports).size).toBe(10);
	// A process of the same run changes nothing; a process of another run cannot remove it.
	expect(openE2eRun({ ...first }).root).toBe(mine.root);
	closeE2eRun({ ...first, HARNESS_E2E_OWNER: '1' });
	closeE2eRun(second);
	expect([existsSync(mine.root), existsSync(theirs.root)]).toEqual([true, false]);
});

test('directories and ports a caller names are used as they are and never removed', () => {
	const root = mkdtempSync(join(tmpdir(), 'named-run-'));
	made.push(root);
	const env: Record<string, string | undefined> = {
		HARNESS_E2E_ROOT: root,
		HARNESS_CONSOLE_E2E_HOME: '/elsewhere/console',
		HARNESS_ANALYTICS_HOME: '/elsewhere/analytics',
		PROJECT_REPORTS_E2E_PORT: '5589'
	};
	const fixtures = openE2eRun(env);
	expect([fixtures.root, fixtures.console, fixtures.analytics]).toEqual([
		root,
		'/elsewhere/console',
		'/elsewhere/analytics'
	]);
	expect([env.PROJECT_REPORTS_E2E_PORT, namedE2eRun(env), env.HARNESS_E2E_OWNER]).toEqual([
		'5589',
		true,
		undefined
	]);
	closeE2eRun(env);
	expect(existsSync(root)).toBe(true);
	expect(namedE2eRun({ HARNESS_E2E_ROOT: root, HARNESS_E2E_OWNER: '1' })).toBe(false);
});

test('free ports can be listened on', async () => {
	const [port] = freePorts(1);
	const server = createServer();
	await new Promise<void>((done, fail) => {
		server.once('error', fail);
		server.listen(port, '127.0.0.1', done);
	});
	await new Promise((done) => server.close(done));
	expect(freePorts(0)).toEqual([]);
});
