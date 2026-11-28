import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectGameCredentialAdapter } from '../../src/adapters/game-authoring/ProjectGameCredentialAdapter';

test('ProjectGameCredentialAdapter reads quoted project keys and hides unexpected Git failures', async () => {
	const name = 'HARNESS_GAME_OPENAI_API_KEY';
	const outside = await mkdtemp(join(tmpdir(), 'harness-credential-'));
	const root = join(outside, 'project');
	try {
		execFileSync('git', ['init', '--quiet', '--template=', root]);
		await writeFile(join(root, '.gitignore'), '.env.local\n');
		await writeFile(join(root, '.env.local'), name + '="synthetic-image-key"\n');
		expect(await new ProjectGameCredentialAdapter(root).read(name)).toBe('synthetic-image-key');
		await writeFile(join(outside, '.env.local'), name + '=synthetic-unowned-key\n');
		await expect(new ProjectGameCredentialAdapter(outside).read(name)).rejects.toThrow(
			'Configure a project-owned ' + name
		);
	} finally {
		await rm(outside, { recursive: true, force: true });
	}
});
