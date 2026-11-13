import { mkdtemp, mkdir, writeFile, utimes, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { staleBuild } from '../../../src/utils/development-tooling/staleBuild';

test('staleBuild warns only when checkout source is newer than its built entry', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-stale-build-'));
	try {
		await mkdir(join(root, 'dist'));
		await mkdir(join(root, 'src', 'nested'), { recursive: true });
		const entry = join(root, 'dist/index.js');
		const source = join(root, 'src/nested/source.ts');
		await writeFile(entry, '// built');
		await writeFile(source, '// source');
		await utimes(entry, 100, 100);
		await utimes(source, 50, 50);
		expect(staleBuild(entry)).toBeUndefined();
		await utimes(source, 150, 150);
		expect(staleBuild(entry)).toMatch(/older than source.*build:cli/);
		expect(staleBuild(source)).toBeUndefined();
		await rm(join(root, 'src'), { recursive: true });
		expect(staleBuild(entry)).toBeUndefined();
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
