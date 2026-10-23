import type { Ask } from './recorded-evidence-transport.test.types';
import { expect } from '../../../test/verificationExpect';
import { afterAll, beforeAll, test } from 'vitest';
import type { RemoteBinary } from '../../remote/src/index';
import type { ProjectSnapshot } from '../src/models/Desktop.types';
import type { EntityEvidenceResult } from '../src/models/DesktopEvidence.types';
import { remoteBinary } from '../src/utils/remoteBinary';
import { localFixture } from './local-transport-fixture';
import { remoteFixture } from './remote-fixture';
import { binding, page, recordedRepo, sha256, type Recorded } from './recorded-evidence-fixture';

let f: Recorded;
beforeAll(async () => {
	f = await recordedRepo();
}, 240_000);
afterAll(() => f.repo.dispose());

const tip = () => ({ commit: f.commits.changed, branch: 'verified', mode: 'current' as const });
/** The refusal code of a request, or `accepted`. */
const outcome = (ask: Ask, method: 'evidence' | 'artifact', input: Record<string, unknown>) =>
	ask(method, input).then(
		() => 'accepted',
		(error: { code?: string }) => error.code ?? 'threw'
	);

/** Reads the evidence of the page and the bytes of its first capture, as a client would. */
async function read(ask: Ask, projectId: string) {
	const scope = { projectId, entityId: page, ...tip() };
	const result = await ask<EntityEvidenceResult>('evidence', scope);
	const [found] = result.evidence.after.captures;
	const query = binding(result, scope, found);
	const sent = await ask<RemoteBinary>('artifact', { ...query });
	return { scope, result, found, query, sent, bytes: await remoteBinary(sent) };
}

test('the window reads recorded evidence and its bytes over the loopback socket', async () => {
	const local = await localFixture(),
		client = local.connect(local.window({ choose: async () => f.root }));
	const { project } = await client.request<ProjectSnapshot>('openProject');
	expect(project.root).toBe(f.root);
	const got = await read((method, input) => client.request(method, input), project.id ?? '');
	expect(got.result.evidence.after.captures).toHaveLength(6);
	expect(got.result.identity.projectId).toBe(project.id);
	expect(got.sent).toMatchObject({
		encoding: 'base64',
		mediaType: 'image/png',
		byteLength: got.bytes.length,
		sha256: got.found.capture.sha256
	});
	expect(sha256(got.bytes)).toBe(got.found.capture.sha256);
	// Whatever else a page sends with a request, such as a path, never reaches the read.
	const padded = { ...got.query, path: '/etc/passwd', media: 'media/x.png' };
	expect((await client.request<RemoteBinary>('artifact', padded)).sha256).toBe(got.sent.sha256);
	const ask: Ask = (method, input) => client.request(method, input);
	await expect(ask('artifact', { ...got.query, sha256: 'HEAD' })).rejects.toThrow('Invalid');
	await expect(ask('artifact', { ...got.query, sha256: 'c'.repeat(64) })).rejects.toThrow(
		/not listed/
	);
}, 90_000);

test('a phone reads the evidence of a granted project and of no other', async () => {
	const remote = await remoteFixture(),
		granted = await remote.registry.register(f.root),
		grant = { projects: [{ id: granted.id, name: granted.name }], agents: false },
		{ client, attachment } = await remote.device(grant).connect();
	expect(attachment.methods).toEqual(expect.arrayContaining(['evidence', 'artifact', 'image']));
	expect(attachment.methods).not.toContain('history');
	const ask: Ask = (method, input) => client.request(method, input);
	const got = await read(ask, granted.id);
	expect(got.sent.mediaType).toBe('image/png');
	expect(sha256(got.bytes)).toBe(got.found.capture.sha256);
	expect(JSON.stringify(got.result)).not.toContain(f.root);
	// The other project of this computer was not granted to this phone.
	for (const projectId of [remote.project.id, `local-${'0'.repeat(64)}`, f.root]) {
		expect(await outcome(ask, 'evidence', { ...got.scope, projectId })).toBe('project-denied');
		expect(await outcome(ask, 'artifact', { ...got.query, projectId })).toBe('project-denied');
	}
	const unnamed: Record<string, unknown> = { ...got.query };
	delete unnamed.projectId;
	expect(await outcome(ask, 'artifact', unnamed)).toBe('project-required');
	expect(await outcome(ask, 'artifact', { ...got.query, side: 'both' })).toBe('invalid-message');
	expect(await outcome(ask, 'artifact', { ...got.query, sha256: 'd'.repeat(64) })).toBe('failed');
}, 90_000);
