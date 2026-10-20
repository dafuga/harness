import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { processStarted, reportServerRecord } from '../../src/utils/reportServerRecord';
import { stopReportServer } from '../../src/services/report-server-service/reportServerRecord';

const started: number[] = [];
const roots: string[] = [];
const alive = (pid: number) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};
/** A stand-in for a server: a process of its own that would run on. */
function sleeper(): number {
	const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
		detached: true,
		stdio: 'ignore'
	});
	child.unref();
	started.push(child.pid ?? -1);
	return child.pid ?? -1;
}
function store(): string {
	const root = mkdtempSync(join(tmpdir(), 'report-server-record-'));
	roots.push(root);
	return root;
}
afterEach(() => {
	for (const pid of started.splice(0)) if (alive(pid)) process.kill(pid, 'SIGKILL');
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('stopping ends exactly the recorded process and forgets it', async () => {
	const root = store();
	const pid = sleeper();
	const record = reportServerRecord(root, 6001);
	await record.write({ pid, port: 6001, started: (await processStarted(pid)) ?? '', buildId: 'b' });
	expect(await stopReportServer(root, 6001)).toEqual({ port: 6001, stopped: true, pid });
	expect([alive(pid), existsSync(record.file)]).toEqual([false, false]);
	// Nothing is recorded any more, so nothing is signalled, on this port or any other.
	expect(await stopReportServer(root, 6001)).toEqual({
		port: 6001,
		stopped: false,
		reason: 'This report store recorded no server on this port.'
	});
});

test('a process that only has the recorded id is not the recorded server and is left alone', async () => {
	const root = store();
	const other = sleeper();
	// As when the recorded server ended long ago and its id now belongs to something else.
	const record = reportServerRecord(root, 6002);
	await record.write({ pid: other, port: 6002, started: 'Thu Jan  1 00:00:00 1970', buildId: 'b' });
	expect(await stopReportServer(root, 6002)).toEqual({
		port: 6002,
		stopped: false,
		pid: other,
		reason: 'The recorded server had already ended.'
	});
	expect([alive(other), existsSync(record.file)]).toEqual([true, false]);
	expect(await processStarted(2 ** 30)).toBeUndefined();
});
