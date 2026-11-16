import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ProjectImageCacheService } from '../../src/lib/development-tooling/desktop-bridge/ProjectImageCacheService';

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
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

test('Reads and caches verified image bytes', async () => {
	const directory = temporaryDirectory();
	const git = join(directory, 'git');
	writeFileSync(git, '#!/bin/sh\ncase "$*" in *rev-parse*) echo example-tree ;; *) exit 0 ;; esac\n');
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
