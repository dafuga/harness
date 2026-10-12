import { realpathSync } from 'node:fs';
import { expect, test } from 'vitest';
import { processProbes } from '../../src/utils/processProbes';

const mac = process.platform === 'darwin';

test.skipIf(!mac)(
	'a process is read as the system shows it: its parent and its program',
	async () => {
		const probes = processProbes();
		expect((await probes.facts(process.pid))?.parent).toBe(process.ppid);
		expect(await probes.executable(process.pid)).toBe(realpathSync(process.execPath));
		expect(await probes.facts(2 ** 30)).toBeNull();
	}
);

test('a tool that does not end is ended within the time allowed and reads as failed', async () => {
	const began = Date.now();
	expect(await processProbes({ timeoutMs: 300 }).ran('/bin/sleep', ['30'])).toEqual({
		ok: false,
		out: ''
	});
	expect(Date.now() - began).toBeLessThan(3000);
});

test('an aborted read ends at once and reads as failed', async () => {
	const control = new AbortController();
	const running = processProbes({ signal: control.signal }).ran('/bin/sleep', ['30']);
	const began = Date.now();
	control.abort();
	expect((await running).ok).toBe(false);
	expect(Date.now() - began).toBeLessThan(2000);
});

test('only a few tools run at a time, however many are asked for', async () => {
	const probes = processProbes();
	const began = Date.now();
	const all = await Promise.all(
		Array.from({ length: 24 }, () => probes.ran('/bin/sleep', ['0.3']))
	);
	expect(all.every((one) => one.ok)).toBe(true);
	expect(Date.now() - began).toBeGreaterThanOrEqual(850);
});
