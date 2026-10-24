import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	actor,
	outsider,
	project,
	unit,
	commit,
	notes,
	evidence,
	projectionFixture
} from '../support/projectionFixture';
test('GitHub snapshot binds exact project, slash branch and all cache revisions', async () => {
	const f = projectionFixture(),
		view = await f.projection.snapshot(actor, project.id, { branch: 'feat/a/b', commit: null });
	expect(view.project.id).toBe(project.id);
	expect(view.revision).toMatchObject({ branch: 'feat/a/b', commit, atTip: true });
	expect(view.capabilities).toMatchObject({ comments: true, agents: false, planning: false });
	expect(view.cache?.identity).toMatchObject({
		principalId: actor.id,
		sourceCommit: commit,
		notesRevision: notes,
		evidenceRevision: evidence
	});
	expect(view.entities[0].id).toBe(unit.id);
	expect(view.entities[0].verification).toBe('unknown');
});
test('membership is checked before cached project, source and media reads', async () => {
	const f = projectionFixture();
	await f.projection.snapshot(actor, project.id, { branch: 'feat/a/b', commit: null });
	await expect(
		f.projection.snapshot(outsider, project.id, { branch: 'feat/a/b', commit: null })
	).rejects.toThrow();
	await expect(
		f.projection.source(outsider, project.id, {
			entityId: unit.id,
			commit,
			path: 'packages/desktop/src/routes/harness/[...path]/+page.svelte'
		})
	).rejects.toThrow();
	await expect(
		f.projection.image(outsider, project.id, {
			entityId: unit.id,
			commit,
			version: 'v001',
			sha256: 'a'.repeat(64)
		})
	).rejects.toThrow();
});
test('source is available only within selected entity ownership', async () => {
	const f = projectionFixture();
	await expect(
		f.projection.source(actor, project.id, { entityId: unit.id, commit, path: unit.id + '.json' })
	).rejects.toThrow();
	expect(
		await f.projection.source(actor, project.id, {
			entityId: unit.id,
			commit,
			path: 'packages/desktop/src/routes/harness/[...path]/+page.svelte'
		})
	).toMatchObject({ text: '<h1>Harness</h1>' });
});

test('registry reads include backend contracts and recheck project membership before cached data', async () => {
	const f = projectionFixture();
	const manifest = readFileSync(
		new URL('../../../../specification/units/entry.program.json', import.meta.url)
	);
	f.files.set('specification/units/entry.program.json', new Uint8Array(manifest));
	const request = () =>
		new Request(
			`https://fixture.example/api/projects/${project.id}/registry?commit=${commit}&branch=feat%2Fa%2Fb`
		);
	const response = await f.controller.handle(request());
	expect(response.status).toBe(200);
	const result = await response.json();
	expect(result.commit).toBe(commit);
	expect(
		result.units.find((entry: { id: string }) => entry.id === 'entry.program').contract.outputs
	).toContainEqual({ name: 'buildProgram', type: 'Command' });
	f.setActor(outsider);
	expect((await f.controller.handle(request())).status).toBe(403);
});
