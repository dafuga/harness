import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { HostedEvidenceService } from '../../src/services/HostedEvidenceService';
import { ProjectionCacheService } from '../../src/services/projection-cache-service/ProjectionCacheService';
import { HostedFailureValidator } from '../../src/validators/HostedFailureValidator';
import { asked, captureOf, hubAnswer, png } from '../hosted-evidence-fixture';

const origin = 'https://hub.example.invalid';
const offline = new HostedFailureValidator('offline');
const unreachable = 'Hosted request failed or access was refused.';
const scopeOf = (operation: string) =>
	JSON.stringify([origin, 'alice', 'p', `/api/projects/p/${operation}?fixture`]);

let root: string;
let cache: ProjectionCacheService;
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'hosted-evidence-service-'));
	cache = new ProjectionCacheService(root);
});
afterEach(() => rm(root, { recursive: true, force: true }));
const files = () => readdir(root).catch(() => [] as string[]);

/** The service over a hub that answers what a test tells it to, with a real cache beside it. */
function fixture() {
	const hub = {
		path: (operation: string, query: { projectId: string }) =>
			`/api/projects/${query.projectId}/${operation}?fixture`,
		evidence: vi.fn(async (): Promise<unknown> => hubAnswer()),
		artifact: vi.fn(async () => ({ bytes: png, mediaType: 'image/png', principalId: 'alice' }))
	};
	const credentials = async () => ({ origin, principalId: 'alice', token: 'private-token' });
	return { hub, service: new HostedEvidenceService(hub, { origin, cache, credentials }) };
}

test('evidence is kept under the identity its own answer states, and read again when the hub cannot be reached', async () => {
	const { hub, service } = fixture();
	const answer = await service.evidence(asked);
	expect(answer).toEqual(hubAnswer());
	expect(hub.evidence).toHaveBeenLastCalledWith(asked);
	const kept = await cache.lookup(scopeOf('evidence'));
	expect(kept).toMatchObject({ identity: answer.identity, value: answer });
	hub.evidence.mockRejectedValue(offline);
	expect(await service.evidence(asked)).toEqual(answer);
	await expect(service.evidence({ ...asked, projectId: 'q' })).rejects.toThrow(unreachable);
});

test('an answer that is refused is never kept, and a kept one is not given in its place', async () => {
	const { hub, service } = fixture();
	const refused: Array<[unknown, RegExp]> = [
		[{ ...hubAnswer(), extra: true }, /does not accept/],
		[hubAnswer({ projectId: 'q' }), /another evidence read/],
		[hubAnswer({ principalId: 'bob' }), /identity mismatch/]
	];
	for (const [answer, words] of refused) {
		hub.evidence.mockResolvedValue(answer);
		await expect(service.evidence(asked)).rejects.toThrow(words);
	}
	expect(await files()).toEqual([]);
	hub.evidence.mockResolvedValue(hubAnswer());
	await service.evidence(asked);
	hub.evidence.mockResolvedValue(hubAnswer({ mode: 'current' }));
	await expect(service.evidence(asked)).rejects.toThrow(/another evidence read/);
});

test('a capture is kept once an answer pinned its revisions, and only served until then', async () => {
	const { hub, service } = fixture();
	const shot = captureOf(png);
	const read = { bytes: png, mediaType: 'image/png', sha256: shot.sha256 };
	expect(await service.artifact(shot)).toEqual(read);
	expect(hub.artifact).toHaveBeenLastCalledWith(shot);
	expect(await files()).toEqual([]);
	await service.evidence(asked);
	const answered = await files();
	expect(await service.artifact(shot)).toEqual(read);
	expect(await cache.lookup(scopeOf('artifact'))).toMatchObject({
		identity: { ...hubAnswer().identity, artifactHash: shot.sha256 }
	});
	hub.artifact.mockRejectedValue(offline);
	expect(await service.artifact(shot)).toEqual(read);
	// Evidence read from its kept copy pins the captures it lists just the same: after another
	// start, with the copy of the capture gone, the capture is kept again once it is read.
	for (const name of await files()) if (!answered.includes(name)) await rm(join(root, name));
	const restarted = fixture();
	restarted.hub.evidence.mockRejectedValue(offline);
	expect(await restarted.service.evidence(asked)).toEqual(hubAnswer());
	expect(await restarted.service.artifact(shot)).toEqual(read);
	expect(await files()).toHaveLength(4);
});
