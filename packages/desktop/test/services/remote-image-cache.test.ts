import { test, expect, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { ProjectionCacheService } from '../../src/services/projection-cache-service/ProjectionCacheService';
import { RemoteImageCacheService } from '../../src/services/networking-security/RemoteImageCacheService';
test('remote projection cache rejects a different verified principal even when source and image hashes match', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-remote-cache-'));
	try {
		const bytes = Buffer.from('fixture-image'),
			hash = createHash('sha256').update(bytes).digest('hex');
		const identity = {
			principalId: 'verified-one',
			projectId: 'project-one',
			repositoryId: 1,
			requestedRef: 'refs/heads/main',
			sourceCommit: 'a'.repeat(40),
			sourceTree: 'b'.repeat(40),
			notesRef: null,
			notesRevision: null,
			evidenceRef: null,
			evidenceRevision: null,
			historyIndexRevision: null,
			artifactHash: hash,
			profile: null
		};
		const context = {
			identity,
			principalId: identity.principalId,
			query: {
				projectId: identity.projectId,
				entityId: 'page.home',
				commit: identity.sourceCommit,
				version: 'v001',
				sha256: hash
			}
		};
		const service = new RemoteImageCacheService(new ProjectionCacheService(root)),
			load = vi.fn(async () => new Uint8Array(bytes));
		expect(await service.read(context, load)).toEqual(new Uint8Array(bytes));
		await expect(service.read({ ...context, principalId: 'another' }, load)).rejects.toThrow(
			'identity'
		);
		expect(load).toHaveBeenCalledTimes(1);
		expect(
			await service.read(
				{ ...context, identity: { ...identity, notesRevision: 'c'.repeat(40) } },
				load
			)
		).toEqual(new Uint8Array(bytes));
		expect(load).toHaveBeenCalledTimes(2);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

function sources(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return sources(path);
		return /\.(ts|js|svelte)$/.test(path) ? [path] : [];
	});
}

test('the relocated service stubs stay removed and nothing imports their old paths', () => {
	const desktop = resolve(import.meta.dirname, '../..');
	const stubs = [
		'RemoteImageCacheService',
		'RemotePairingControlService',
		'RemoteProjectionService',
		'RepositoryArbiterService'
	].map((name) => resolve(desktop, 'src/services', name));
	const roots = [
		resolve(desktop, 'src'),
		resolve(desktop, 'test'),
		resolve(desktop, '../reports/src')
	];
	const dependencies = roots.flatMap((root) =>
		sources(root).flatMap((path) =>
			[
				...readFileSync(path, 'utf8').matchAll(
					/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*|\bvi\.mock\(\s*)['"]([^'"]+)['"]/g
				)
			]
				.filter(([, specifier]) => stubs.includes(resolve(dirname(path), specifier)))
				.map(([, specifier]) => `${relative(desktop, path)} -> ${specifier}`)
		)
	);
	expect(dependencies, 'removed relocation stubs must not be imported').toEqual([]);
	expect(
		stubs.filter((stub) => existsSync(`${stub}.ts`)),
		'removed relocation stubs must stay deleted'
	).toEqual([]);
});
