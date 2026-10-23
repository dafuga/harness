import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { benchmarkProcess } from '../src/cli/program/benchmark-service/benchmarkProcess';

test('deadline stops the spawned process instead of leaving background work', async () => {
	const root = await mkdtemp(join(tmpdir(), 'benchmark-cancel-'));
	try {
		const signal = AbortSignal.timeout(200);
		await expect(
			benchmarkProcess({
				cwd: root,
				signal,
				command: [
					'bun',
					'-e',
					"setInterval(() => require('fs').writeFileSync('heartbeat', String(Date.now())), 10)"
				]
			})
		).rejects.toThrow();
		const before = await readFile(join(root, 'heartbeat'), 'utf8');
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(await readFile(join(root, 'heartbeat'), 'utf8')).toBe(before);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
