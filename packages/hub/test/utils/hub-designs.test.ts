import { expect, test } from 'vitest';
import { hubHash } from '../../src/utils/hubJson';
import { actor, project, unit, commit } from '../support/projectionFixture';
import { designFixture } from '../support/designFixture';
test('exact committed plan image renders and foreign versions fail', async () => {
	const f = await designFixture();
	const entity = await f.projection.entity(actor, project.id, {
		entityId: unit.id,
		commit,
		branch: 'feat/a/b'
	});
	expect(entity.versions[0].images[0].sha256).toBe(f.hash);
	expect(entity.hasPlan).toBe(true);
	expect(
		await f.projection.image(actor, project.id, {
			entityId: unit.id,
			commit,
			version: 'v001',
			sha256: f.hash
		})
	).toEqual(f.png);
	await expect(
		f.projection.image(actor, project.id, {
			entityId: unit.id,
			commit,
			version: 'v002',
			sha256: f.hash
		})
	).rejects.toThrow();
});
test('media cannot bypass canonical plan identity or category attestation', async () => {
	const f = await designFixture();
	f.files.set(f.path + '/plan.json', f.json({ ...f.plan, unitId: 'unregistered.page' }));
	await expect(
		f.projection.image(actor, project.id, {
			entityId: 'unregistered.page',
			commit,
			version: 'v001',
			sha256: f.hash
		})
	).rejects.toThrow();
});
test('tampered contract, prompt or image fails rather than borrowing cache', async () => {
	const f = await designFixture();
	await f.projection.image(actor, project.id, {
		entityId: unit.id,
		commit,
		version: 'v001',
		sha256: f.hash
	});
	f.files.set(f.path + '/designs/v001/default-desktop.png', new TextEncoder().encode('wrong'));
	await expect(
		f.projection.image(actor, project.id, {
			entityId: unit.id,
			commit,
			version: 'v001',
			sha256: f.hash
		})
	).rejects.toThrow();
	f.files.set(f.path + '/designs/v001/prompt.md', new TextEncoder().encode('changed'));
	await expect(
		f.projection.entity(actor, project.id, { entityId: unit.id, commit, branch: 'feat/a/b' })
	).rejects.toThrow();
});
test('version commit identifies the recorded introduction rather than the viewed revision', async () => {
	const f = await designFixture(),
		introduced = '9'.repeat(40),
		seen: unknown[] = [];
	f.source.historyPage = async (_repo, input) => {
		seen.push(input);
		return {
			commits: [{ hash: introduced, subject: 'feat: design', authoredAt: f.plan.createdAt }],
			complete: true,
			nextPage: null
		};
	};
	const entity = await f.projection.entity(actor, project.id, {
		entityId: unit.id,
		commit,
		branch: 'feat/a/b'
	});
	expect(entity.versions[0].commit).toBe(introduced);
	expect(seen).toContainEqual({
		commit,
		paths: [f.path + '/designs/v001/design.json'],
		perPage: 2,
		page: 1
	});
});
test('rewritten or incomplete version history never claims an introduction commit', async () => {
	const f = await designFixture();
	f.source.historyPage = async () => ({
		commits: [{ hash: commit, subject: 'feat: design', authoredAt: f.plan.createdAt }],
		complete: false,
		nextPage: 2
	});
	const entity = await f.projection.entity(actor, project.id, {
		entityId: unit.id,
		commit,
		branch: 'feat/a/b'
	});
	expect(entity.versions[0].commit).toBeNull();
});

test('image API rejects hash-bound fake PNG headers without complete image data', async () => {
	const f = await designFixture();
	const fake = new Uint8Array(33);
	fake.set([137, 80, 78, 71, 13, 10, 26, 10]);
	const view = new DataView(fake.buffer);
	view.setUint32(16, 1);
	view.setUint32(20, 1);
	const hash = await hubHash(fake);
	f.files.set(f.path + '/designs/v001/default-desktop.png', fake);
	f.files.set(
		f.path + '/designs/v001/design.json',
		f.json({ ...f.design, images: [{ ...f.design.images[0], sha256: hash, bytes: fake.length }] })
	);
	const query = new URLSearchParams({ entityId: unit.id, commit, version: 'v001', sha256: hash });
	const response = await f.controller.handle(
		new Request(`https://fixture.example/api/projects/${project.id}/image?${query}`)
	);
	expect(response.status).toBe(409);
	expect(await response.json()).toEqual({ error: 'artifact-corrupt' });
});
