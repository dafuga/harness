import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ProjectionCacheService } from '../../src/lib/development-tooling/desktop-initialization/projection-cache-service/ProjectionCacheService';
import { HostedCacheIdentityMismatchError } from '../../src/services/networking-security/HostedCacheIdentityMismatchError';
import { IncompleteHostedCacheIdentityError } from '../../src/services/networking-security/IncompleteHostedCacheIdentityError';
import { RemoteImageCacheService } from '../../src/services/networking-security/RemoteImageCacheService';

const identity = {
	principalId: 'google-example-1042',
	projectId: 'project-example-42',
	repositoryId: 42,
	requestedRef: 'main',
	sourceCommit: 'commit-example-1',
	sourceTree: 'tree-example-1',
	notesRef: 'refs/notes/harness',
	notesRevision: null,
	evidenceRef: 'refs/heads/harness-evidence',
	evidenceRevision: null,
	historyIndexRevision: null,
	artifactHash: '',
	profile: null
};

function request(artifactHash: string) {
	const boundIdentity = { ...identity, artifactHash };
	return {
		identity: boundIdentity,
		principalId: boundIdentity.principalId,
		query: {
			projectId: boundIdentity.projectId,
			entityId: 'page.activity',
			commit: boundIdentity.sourceCommit,
			version: 'v001',
			sha256: artifactHash
		}
	};
}

function errorSummary(error: unknown) {
	return error instanceof Error ? { name: error.name, message: error.message } : String(error);
}

async function identityFailures(service: RemoteImageCacheService) {
	const validContext = request('a'.repeat(64));
	const mismatch = await service
		.read({ ...validContext, principalId: 'google-other-999' }, async () => new Uint8Array())
		.then(() => null, errorSummary);
	const incompleteIdentity = { ...validContext.identity } as Partial<typeof validContext.identity>;
	delete incompleteIdentity.repositoryId;
	const incomplete = await service
		.read(
			{ ...validContext, identity: incompleteIdentity as typeof validContext.identity },
			async () => new Uint8Array()
		)
		.then(() => null, errorSummary);
	return { validContext, incompleteIdentity, mismatch, incomplete };
}

test('Reads and fills the hosted image cache', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'remote-image-cache-'));
	try {
		const payload = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
		const hash = createHash('sha256').update(payload).digest('hex');
		const context = request(hash);
		const cache = new ProjectionCacheService(directory);
		const service = new RemoteImageCacheService(cache);
		let loads = 0;
		const first = await service.read(context, async () => {
			loads++;
			return payload;
		});
		const second = await service.read(context, async () => {
			loads++;
			return new Uint8Array([0]);
		});
		const output = {
			firstBytes: Array.from(first),
			secondBytes: Array.from(second),
			firstAndLoadedArrayMatch: first === payload,
			secondIsCachedArray: second !== payload,
			loadCalls: loads
		};
		expect(output).toEqual({
			firstBytes: Array.from(payload),
			secondBytes: Array.from(payload),
			firstAndLoadedArrayMatch: true,
			secondIsCachedArray: true,
			loadCalls: 1
		});
		recordExampleCases(
			{
				unitId: 'desktop.service.remote-image-cache',
				symbol: 'read',
				state: 'reads-and-fills-the-hosted-image-cache',
				evidence: 'examples-cases',
				file: 'reads-and-fills-the-hosted-image-cache.json'
			},
			[
				{
					name: 'A cache miss loads and stores bytes, then a cache hit skips loading',
					input: { context, loadedBytes: Array.from(payload), secondLoadWouldReturn: [0] },
					output
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Rejects mismatched and incomplete hosted cache identities', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'remote-image-cache-invalid-'));
	try {
		const service = new RemoteImageCacheService(new ProjectionCacheService(directory));
		const { validContext, incompleteIdentity, mismatch, incomplete } =
			await identityFailures(service);
		const output = { mismatch, incomplete };
		expect(output).toEqual({
			mismatch: {
				name: HostedCacheIdentityMismatchError.name,
				message: 'Hosted cache identity mismatch.'
			},
			incomplete: {
				name: IncompleteHostedCacheIdentityError.name,
				message: 'Incomplete hosted cache identity.'
			}
		});
		recordExampleCases(
			{
				unitId: 'desktop.service.remote-image-cache',
				symbol: 'read',
				state: 'rejects-mismatched-and-incomplete-hosted-cache-identities',
				evidence: 'examples-cases',
				file: 'rejects-mismatched-and-incomplete-hosted-cache-identities.json'
			},
			[
				{
					name: 'Principal mismatch rejects before loading',
					input: { context: { ...validContext, principalId: 'google-other-999' } },
					error: output.mismatch
				},
				{
					name: 'Missing own repositoryId rejects even when the other identity fields match',
					input: {
						context: {
							...validContext,
							identity: incompleteIdentity as typeof validContext.identity
						}
					},
					error: output.incomplete
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
