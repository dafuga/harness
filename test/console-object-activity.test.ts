import { expect, test } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consoleObjects } from '../src/workflows/installConsole';

test('bucket upload manifests include recorded activity beside the index and exclude unrelated files', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-console-activity-'));
	try {
		await writeFile(join(root, 'index.json'), '{}');
		await writeFile(join(root, 'activity.json'), '{"kind":"recorded"}');
		await writeFile(join(root, 'unrelated.json'), '{"private":"fixture"}');
		const objects = await consoleObjects(root, 'history');
		expect(objects.map((item) => item.key)).toEqual([
			'history/activity.json',
			'history/index.json'
		]);
		expect(objects[0].file).toBe(join(root, 'activity.json'));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
