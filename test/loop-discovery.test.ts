import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { searchLoops } from '../src/workflows/loopSearch';

test('template discovery skips local loop directories without loop state', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-loop-discovery-'));
	try {
		await mkdir(join(root, 'specification/loops/incomplete'), { recursive: true });
		expect((await searchLoops({ root, query: 'bug-fix' })).map((result) => result.id)).toContain(
			'bug-fix'
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
