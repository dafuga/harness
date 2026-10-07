import { expect, test } from 'vitest';
import { mkdtemp, mkdir, writeFile, utimes, symlink, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reportLocalCleanup } from '../../src/utils/reportLocalCleanup';
test('old loose caches and orphan runs expire without following links or deleting fresh files', async () => {
	const root = await mkdtemp(join(tmpdir(), 'report-loose-'));
	const external = await mkdtemp(join(tmpdir(), 'external-source-'));
	try {
		await mkdir(join(root, 'captures'));
		await mkdir(join(root, 'runs', 'orphan'), { recursive: true });
		const old = new Date('2000-01-01');
		for (const file of ['captures/old.png', 'runs/orphan/report.zip']) {
			await writeFile(join(root, file), 'old');
			await utimes(join(root, file), old, old);
		}
		await writeFile(join(root, 'captures', 'fresh.png'), 'fresh');
		await writeFile(join(external, 'source.wav'), 'source');
		await symlink(external, join(root, 'linked'));
		const cutoff = Date.now() - 30 * 86400000;
		expect(await reportLocalCleanup(root, cutoff, true)).toBe(2);
		expect(await stat(join(root, 'captures', 'old.png'))).toBeTruthy();
		expect(await reportLocalCleanup(root, cutoff)).toBe(2);
		await expect(stat(join(root, 'captures', 'old.png'))).rejects.toMatchObject({ code: 'ENOENT' });
		expect(await stat(join(root, 'captures', 'fresh.png'))).toBeTruthy();
		expect(await stat(join(external, 'source.wav'))).toBeTruthy();
		await symlink(root, join(external, 'unsafe-root'));
		await expect(reportLocalCleanup(join(external, 'unsafe-root'), cutoff)).rejects.toThrow('root');
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(external, { recursive: true, force: true });
	}
});
