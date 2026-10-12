import { expect } from '../../../test/verificationExpect';
import { afterEach, test, vi } from 'vitest';
import { ProjectSessionService } from '../src/services/ProjectSessionService';
import { deferred, remoteFixture } from './remote-fixture';
import { git } from './run-fixture';

afterEach(() => vi.restoreAllMocks());

test('an explicitly pinned current-tip snapshot cannot authorize a mutation', async () => {
	const f = await remoteFixture();
	const { client } = await f.device().connect();
	const projectId = f.project.id;
	const revision = f.revision();
	await client.request('snapshot', { projectId, ...revision });
	const result = await client
		.request('createPlan', { projectId, revision, category: 'pages', title: 'Pinned', goal: 'Pin' })
		.then(
			() => 'accepted',
			(error: { code: string }) => error.code
		);
	expect(result).toBe('read-only');
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(revision.commit);
}, 30_000);

test('revoking a session during project opening prevents the deferred write', async () => {
	const f = await remoteFixture();
	const phone = f.device();
	const { link, attachment } = await phone.connect();
	const entered = deferred(),
		release = deferred();
	const original = ProjectSessionService.prototype.open;
	vi.spyOn(ProjectSessionService.prototype, 'open').mockImplementation(async function (
		this: ProjectSessionService,
		root
	) {
		entered.resolve();
		await release.promise;
		return original.call(this, root);
	});
	const revision = f.revision();
	const pending = link.receive(
		JSON.stringify({
			type: 'request',
			id: crypto.randomUUID(),
			method: 'createPlan',
			input: {
				projectId: f.project.id,
				revision,
				epoch: attachment.epoch,
				category: 'pages',
				title: 'Revoked',
				goal: 'Must not write'
			}
		})
	);
	await entered.promise;
	phone.session.end();
	release.resolve();
	await pending;
	expect(phone.session.wire.ended).toBe(true);
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(revision.commit);
	expect(f.run).not.toHaveBeenCalled();
}, 30_000);

test('revoking during provider preparation cannot append a request or start a CLI', async () => {
	const f = await remoteFixture();
	const phone = f.device();
	const { client, link, attachment } = await phone.connect();
	await client.request('snapshot', { projectId: f.project.id, branch: null, commit: null });
	const entered = deferred(),
		release = deferred();
	const original = f.providers.select.bind(f.providers);
	vi.spyOn(f.providers, 'select').mockImplementation(async (...args) => {
		entered.resolve();
		await release.promise;
		return original(...args);
	});
	const revision = f.revision();
	const pending = link.receive(
		JSON.stringify({
			type: 'request',
			id: crypto.randomUUID(),
			method: 'startRun',
			input: { ...f.start(), epoch: attachment.epoch }
		})
	);
	await entered.promise;
	phone.session.end();
	release.resolve();
	await pending;
	await expect.poll(() => f.arbiter.held(f.root), { timeout: 15_000 }).toBe(false);
	expect(f.run).not.toHaveBeenCalled();
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(revision.commit);
}, 30_000);
