import { expect, test } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture } from '../project-fixture';
import { ProjectGameCredentialAdapter } from '../../src/adapters/ProjectGameCredentialAdapter';

test('ProjectGameCredentialAdapter reads quoted project keys and hides unexpected Git failures', async () => {
	const name = 'HARNESS_GAME_OPENAI_API_KEY';
	const { root } = await fixture();
	await writeFile(join(root, '.gitignore'), '.env.local\n');
	await writeFile(join(root, '.env.local'), name + '="synthetic-image-key"\n');
	expect(await new ProjectGameCredentialAdapter(root).read(name)).toBe('synthetic-image-key');
	const outside = await mkdtemp(join(tmpdir(), 'harness-credential-'));
	try {
		await writeFile(join(outside, '.env.local'), name + '=synthetic-unowned-key\n');
		await expect(new ProjectGameCredentialAdapter(outside).read(name)).rejects.toThrow(
			'Configure a project-owned ' + name
		);
	} finally {
		await rm(outside, { recursive: true, force: true });
	}
});
