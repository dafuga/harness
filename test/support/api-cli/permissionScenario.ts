import { expect } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runHarness } from '../cli';
import { permissionProfiles } from '../permissionProfiles';

/** The standard API CLI also reads the application's committed permission declarations. */
export async function assertPermissionCli(): Promise<void> {
	const root = await mkdtemp(join(tmpdir(), 'permission-cli-'));
	try {
		await mkdir(join(root, 'specification/permissions'), { recursive: true });
		for (const { source, ...profile } of permissionProfiles.profiles)
			await writeFile(join(root, source), JSON.stringify(profile));
		const listed = JSON.parse(
			(await runHarness(['permissions', 'list', '--root', root, '--json'], root)).stdout
		);
		expect(listed.profiles.map((profile: { id: string }) => profile.id)).toEqual([
			'admin',
			'guest',
			'member'
		]);
		const shown = JSON.parse(
			(await runHarness(['permissions', 'show', 'member', '--root', root], root)).stdout
		);
		expect(shown.grants).toEqual(permissionProfiles.profiles[1].grants);
		const api = JSON.parse(
			(await runHarness(['api', 'permissions', 'app.endpoint.orders', '--root', root], root)).stdout
		);
		expect(api.profiles.map((profile: { id: string }) => profile.id)).toEqual(['admin', 'member']);
		expect(
			api.profiles.find((profile: { id: string }) => profile.id === 'member').grants[0].data[0]
		).toEqual({
			resource: 'app.model.order',
			actions: ['read'],
			fields: ['id', 'total'],
			scope: 'Own account only'
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}
