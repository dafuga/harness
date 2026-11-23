import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ProjectImageCacheService } from '../../src/lib/development-tooling/desktop-bridge/ProjectImageCacheService';
import { ImageHashMismatchError } from '../../src/lib/development-tooling/desktop-bridge/ImageHashMismatchError';
import { UnknownProjectImageError } from '../../src/lib/development-tooling/desktop-bridge/UnknownProjectImageError';

const directories: string[] = [];

function temporaryDirectory() {
	const directory = mkdtempSync(join(tmpdir(), 'project-image-cache-'));
	directories.push(directory);
	return directory;
}

function fakeSession(root: string, sha256: string, byteLength: number) {
	const cached: Uint8Array[] = [];
	return Object.assign(
		{
			projectId: 'local-example-project',
			assertProject: () => undefined,
			requireProject: () => ({
				root,
				catalog: {
					entity: async () => ({
						versions: [{ version: 'v002', images: [{ sha256, bytes: byteLength }] }]
					})
				},
				planning: { image: async () => new Uint8Array([137, 80, 78, 71]) }
			}),
			cache: {
				get: async () => undefined,
				put: async (_identity: unknown, bytes: Uint8Array) => cached.push(bytes)
			}
		},
		{ cached }
	);
}

afterEach(() => {
	vi.unstubAllEnvs();
	for (const directory of directories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});

test('Reads and caches verified image bytes', async () => {
	const directory = temporaryDirectory();
	const git = join(directory, 'git');
	writeFileSync(
		git,
		'#!/bin/sh\ncase "$*" in *rev-parse*) echo example-tree ;; *) exit 0 ;; esac\n'
	);
	chmodSync(git, 0o755);
	vi.stubEnv('PATH', directory);
	const bytes = new Uint8Array([137, 80, 78, 71]);
	const sha256 = createHash('sha256').update(bytes).digest('hex');
	const session = fakeSession(directory, sha256, bytes.length);
	const service = new ProjectImageCacheService(session as never);
	const input = {
		projectId: 'local-example-project',
		entityId: 'desktop.component.workspace-shell',
		commit: '9c4e1a7b52d08f63e1a94c27b0d5f8e3a61c2b7d',
		version: 'v002',
		sha256
	};
	const result = await service.read(input);
	const output = Array.from(result);
	expect(output).toEqual(Array.from(bytes));
	expect(session.cached).toEqual([bytes]);
	recordExampleCases(
		{
			unitId: 'desktop.service.project-image-cache',
			symbol: 'read',
			state: 'reads-and-caches-verified-image-bytes',
			evidence: 'examples-cases',
			file: 'reads-and-caches-verified-image-bytes.json'
		},
		[{ name: 'Fetches the requested design image and caches verified bytes', input, output }]
	);
});

test('Throws Error when requested project is not selected', async () => {
	const session = {
		projectId: 'local-example-project',
		assertProject: () => {
			throw new Error('The requested project is not selected.');
		},
		requireProject: () => {
			throw new Error('Open a project first.');
		}
	};
	const service = new ProjectImageCacheService(session as never);
	const input = {
		projectId: 'another-project',
		entityId: 'desktop.component.workspace-shell',
		commit: '9c4e1a7b52d08f63e1a94c27b0d5f8e3a61c2b7d',
		version: 'v002',
		sha256: '3f9a1c7e04b2d85a6e10c9f2b7d4a8e13c5f60b92d7e4a1c08f3b5d6e9a2c741'
	};
	const error = new Error('The requested project is not selected.');
	await expect(service.read(input)).rejects.toThrow(error.message);
	recordExampleCases(
		{
			unitId: 'desktop.service.project-image-cache',
			symbol: 'read',
			state: 'throws-error-when-requested-project-is-not-selected',
			evidence: 'examples-cases',
			file: 'throws-error-when-requested-project-is-not-selected.json'
		},
		[{ name: 'Rejects an unselected project request', input, error: error.message }]
	);
});

test('Throws Error when no project is open', async () => {
	const session = {
		projectId: null,
		assertProject: () => undefined,
		requireProject: () => {
			throw new Error('Open a project first.');
		}
	};
	const input = {
		entityId: 'reports.component.select',
		commit: '4a0f7e2d91bc3865e0d72a1f4c9b58e6d3a0712f',
		version: 'v001',
		sha256: 'a71d0e6c25f9b3481e7d0c59a6f2b8e43d10c7a95e2f6b8d0c31a4e97f5b2d68'
	};
	const error = new Error('Open a project first.');
	await expect(new ProjectImageCacheService(session as never).read(input)).rejects.toThrow(
		error.message
	);
	recordExampleCases(
		{
			unitId: 'desktop.service.project-image-cache',
			symbol: 'read',
			state: 'throws-error-when-no-project-is-open',
			evidence: 'examples-cases',
			file: 'throws-error-when-no-project-is-open.json'
		},
		[{ name: 'Rejects when there is no selected project', input, error: error.message }]
	);
});

test('Throws UnknownProjectImageError when image is not recorded', async () => {
	const directory = temporaryDirectory();
	const session = fakeSession(directory, 'unrelated-hash', 4);
	const input = {
		entityId: 'desktop.component.workspace-shell',
		commit: '9c4e1a7b52d08f63e1a94c27b0d5f8e3a61c2b7d',
		version: 'v002',
		sha256: 'missing-image-hash'
	};
	const error = new UnknownProjectImageError('Unknown project image.');
	await expect(new ProjectImageCacheService(session as never).read(input)).rejects.toThrow(
		error.message
	);
	recordExampleCases(
		{
			unitId: 'desktop.service.project-image-cache',
			symbol: 'read',
			state: 'throws-unknownprojectimageerror-when-image-is-not-recorded',
			evidence: 'examples-cases',
			file: 'throws-unknownprojectimageerror-when-image-is-not-recorded.json'
		},
		[{ name: 'Rejects an image absent from the requested version', input, error: error.message }]
	);
});

test('Throws ImageHashMismatchError when fetched bytes do not match', async () => {
	const directory = temporaryDirectory();
	const git = join(directory, 'git');
	writeFileSync(
		git,
		'#!/bin/sh\ncase "$*" in *rev-parse*) echo example-tree ;; *) exit 0 ;; esac\n'
	);
	chmodSync(git, 0o755);
	vi.stubEnv('PATH', directory);
	const expected = new Uint8Array([1, 2, 3, 4]);
	const input = {
		entityId: 'desktop.component.workspace-shell',
		commit: '9c4e1a7b52d08f63e1a94c27b0d5f8e3a61c2b7d',
		version: 'v002',
		sha256: createHash('sha256').update(expected).digest('hex')
	};
	const session = fakeSession(directory, input.sha256, expected.length);
	const error = new ImageHashMismatchError('Image hash mismatch.');
	await expect(new ProjectImageCacheService(session as never).read(input)).rejects.toThrow(
		error.message
	);
	recordExampleCases(
		{
			unitId: 'desktop.service.project-image-cache',
			symbol: 'read',
			state: 'throws-imagehashmismatcherror-when-fetched-bytes-do-not-matc',
			evidence: 'examples-cases',
			file: 'throws-imagehashmismatcherror-when-fetched-bytes-do-not-matc.json'
		},
		[{ name: 'Rejects fetched bytes with a different digest', input, error: error.message }]
	);
});
