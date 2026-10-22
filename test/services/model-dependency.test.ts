import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { ModelDependencyService } from '../../src/services/development-tooling/ModelDependencyService';

test('an explicit runtime is preserved and a development-only runtime becomes a production dependency', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-model-dependency-'));
	try {
		const path = join(root, 'package.json');
		const service = new ModelDependencyService();
		await writeFile(
			path,
			JSON.stringify({
				name: 'consumer',
				devDependencies: { '@dafuga01/harness': 'file:runtime.tgz' }
			})
		);
		await service.ensure(root);
		const manifest = JSON.parse(await readFile(path, 'utf8'));
		expect(manifest.dependencies['@dafuga01/harness']).toBe('file:runtime.tgz');
		expect(manifest.devDependencies['@dafuga01/harness']).toBeUndefined();
		expect(await service.ensure(root)).toEqual([]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
