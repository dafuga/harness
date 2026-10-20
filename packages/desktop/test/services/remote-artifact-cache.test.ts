import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { CacheIdentity } from '../../../collaboration/src/models/Collaboration.types';
import type { EvidenceArtifactQuery } from '../../src/models/DesktopEvidence.types';
import { HostedReadService } from '../../src/services/HostedReadService';
import { ProjectionCacheService } from '../../src/services/projection-cache-service/ProjectionCacheService';
import { RemoteArtifactCacheService } from '../../src/services/RemoteArtifactCacheService';
import { HostedFailureValidator } from '../../src/validators/HostedFailureValidator';

const origin = 'https://hub.example.invalid';
const [commit, notes, evidence] = ['a', 'c', 'd'].map((letter) => letter.repeat(40));
const sha256 = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const base64 = (value: Uint8Array) => Buffer.from(value).toString('base64');
const bytes = new TextEncoder().encode('{"ok":true}');
const other = new TextEncoder().encode('{"ok":false}');
const json = 'application/json';
/** What an evidence answer of alice for project `p` was read at. */
const identity: CacheIdentity = {
	collaborationRevision: null,
	principalId: 'alice',
	projectId: 'p',
	repositoryId: 7,
	requestedRef: 'main',
	sourceCommit: commit,
	sourceTree: 'f'.repeat(40),
	notesRef: 'refs/notes/harness',
	notesRevision: notes,
	evidenceRef: 'refs/heads/harness-evidence',
	evidenceRevision: evidence,
	historyIndexRevision: null,
	artifactHash: null,
	profile: null
};
const query: EvidenceArtifactQuery & { projectId: string } = {
	projectId: 'p',
	entityId: 'page.home',
	commit,
	branch: 'main',
	mode: 'current',
	side: 'after',
	recordId: 'b'.repeat(64),
	scenarioId: 'home-page',
	state: 'filled',
	evidenceId: 'result',
	viewport: null,
	sha256: sha256(bytes),
	notesRevision: notes,
	evidenceRevision: evidence
};
const read = { key: '/api/projects/p/artifact?fixture', query };
const answer = { bytes, mediaType: json, sha256: query.sha256 };
const kept = { ...identity, artifactHash: query.sha256 };
const unreachable = 'Hosted request failed or access was refused.';
const sent = async () => ({ bytes, mediaType: json, principalId: 'alice' });
const failed =
	(category: 'offline' | 'denied' | 'failed', status = 0) =>
	async () => {
		throw new HostedFailureValidator(category, status);
	};
const offline = failed('offline');
const scope = JSON.stringify([origin, 'alice', 'p', read.key]);

let root: string;
let cache: ProjectionCacheService;
let principal: string;
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'hosted-artifact-'));
	cache = new ProjectionCacheService(root);
	principal = 'alice';
});
afterEach(() => rm(root, { recursive: true, force: true }));
const files = () => readdir(root).catch(() => [] as string[]);
/** The keeper as one start of the app has it: it knows only the answers pinned in it. */
function service() {
	const credentials = async () => ({ origin, principalId: principal, token: 'private-token' });
	return new RemoteArtifactCacheService(new HostedReadService({ origin, cache, credentials }));
}

test('a checked artifact is kept under the identity of the answer that pinned its revisions, and read again offline', async () => {
	const keeper = service();
	keeper.pin(identity);
	expect(await keeper.read(read, sent)).toEqual(answer);
	expect(await cache.lookup(scope)).toMatchObject({ identity: kept });
	expect(await keeper.read(read, offline)).toEqual(answer);
	// Another start of the app has pinned nothing, and needs nothing to read what is kept.
	expect(await service().read(read, offline)).toEqual(answer);
});

test('bytes of revisions that no answer pinned are served and not kept', async () => {
	const keeper = service();
	keeper.pin({ ...identity, notesRevision: 'f'.repeat(40) });
	keeper.pin({ ...identity, evidenceRevision: null });
	keeper.pin({ ...identity, sourceCommit: 'b'.repeat(40) });
	keeper.pin({ ...identity, projectId: 'q' });
	keeper.pin({ ...identity, principalId: 'bob' });
	expect(await keeper.read(read, sent)).toEqual(answer);
	expect(await files()).toEqual([]);
	await expect(keeper.read(read, offline)).rejects.toThrow(unreachable);
});

test('another principal, project or address never reads a kept artifact', async () => {
	const keeper = service();
	keeper.pin(identity);
	await keeper.read(read, sent);
	principal = 'bob';
	await expect(keeper.read(read, offline)).rejects.toThrow(unreachable);
	principal = 'alice';
	const elsewhere = [
		{ key: read.key, query: { ...query, projectId: 'q' } },
		{ key: `${read.key}&side=before`, query: { ...query, side: 'before' as const } }
	];
	for (const asked of elsewhere)
		await expect(keeper.read(asked, offline)).rejects.toThrow(unreachable);
	expect(await keeper.read(read, offline)).toEqual(answer);
});

test('the hub is asked every time: a kept copy never stands in while it answers or refuses', async () => {
	const keeper = service();
	keeper.pin(identity);
	const load = vi.fn(sent);
	await keeper.read(read, load);
	await keeper.read(read, load);
	expect(load).toHaveBeenCalledTimes(2);
	await expect(keeper.read(read, failed('failed', 409))).rejects.toMatchObject({ status: 409 });
	expect(await files()).toHaveLength(2);
	// A refusal of access lets go of what this principal kept of the project.
	await expect(keeper.read(read, failed('denied', 403))).rejects.toMatchObject({ status: 403 });
	expect(await files()).toEqual([]);
	await expect(keeper.read(read, offline)).rejects.toThrow(unreachable);
});

test('nothing is kept when what was received fails a check', async () => {
	const keeper = service();
	keeper.pin(identity);
	const unchecked = [
		async () => ({ bytes: other, mediaType: json, principalId: 'alice' }),
		async () => ({ bytes, mediaType: 'text/html', principalId: 'alice' })
	];
	for (const load of unchecked) await expect(keeper.read(read, load)).rejects.toThrow();
	expect(await files()).toEqual([]);
});

test('a kept copy that is not what it is asked by is discarded, never served', async () => {
	const keeper = service();
	const unkept: Array<[unknown, RegExp]> = [
		// Kept consistently by the cache itself, so only the hash a capture is asked by tells.
		[{ mediaType: json, data: base64(other) }, /SHA-256/],
		[{ mediaType: 'text/html', data: base64(bytes) }, /does not show/],
		[{ mediaType: json }, /./],
		['not an artifact', /./]
	];
	for (const [value, words] of unkept) {
		await cache.remember(scope, kept, value);
		await expect(keeper.read(read, offline)).rejects.toThrow(words);
		expect(await cache.lookup(scope)).toBeNull();
		expect(await files()).toEqual([]);
	}
	// What is kept as a checked artifact is the form this reads back.
	await cache.remember(scope, kept, { mediaType: json, data: base64(bytes) });
	expect(await keeper.read(read, offline)).toEqual(answer);
});
