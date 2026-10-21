import { expect, test, vi } from 'vitest';
import { writeFile, unlink, symlink, mkdir, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, git } from '../project-fixture';
import { GameRenderService } from '../../src/services/GameRenderService';
test('game credentials require the current project ignored regular file', async () => {
	const { root, session } = await fixture();
	const name = 'HARNESS_GAME_DECART_API_KEY';
	const send = vi.fn(
		async () => new Response(JSON.stringify({ apiKey: 'synthetic-ephemeral', expiresAt: '2099' }))
	);
	const service = new GameRenderService(session, () => true, send);
	const start = () =>
		service.start({ projectId: session.projectId!, model: 'lucy-2.5', fast: true, seconds: 10 });
	await expect(start()).rejects.toThrow('Configure a project-owned ' + name);
	await writeFile(join(root, '.env.local'), name + '=synthetic-project-key\n');
	await expect(start()).rejects.toThrow('Credential file must be ignored.');
	await writeFile(join(root, '.gitignore'), '.env.local\n');
	git(root, 'add', '-f', '.env.local');
	await expect(start()).rejects.toThrow('Credential file must be ignored.');
	git(root, 'rm', '--cached', '.env.local');
	await unlink(join(root, '.env.local'));
	await writeFile(join(root, 'outside.env'), name + '=synthetic-outside-key\n');
	await symlink(join(root, 'outside.env'), join(root, '.env.local'));
	await expect(start()).rejects.toThrow('Credential file must be regular.');
	await unlink(join(root, '.env.local'));
	await mkdir(join(root, '.env.local'));
	await expect(start()).rejects.toThrow('Credential file must be regular.');
	await rmdir(join(root, '.env.local'));
	await writeFile(join(root, '.env.local'), 'OTHER_KEY=synthetic-other-key\n');
	await expect(start()).rejects.toThrow('Configure a project-owned ' + name);
	expect(send).not.toHaveBeenCalled();
	await writeFile(join(root, '.env.local'), name + '=synthetic-project-key\n');
	expect((await start()).apiKey).toBe('synthetic-ephemeral');
	expect(send.mock.calls[0]).toMatchObject([
		expect.any(String),
		{ headers: { 'X-API-KEY': 'synthetic-project-key' } }
	]);
});
