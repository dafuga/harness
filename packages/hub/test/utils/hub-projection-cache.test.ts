import { expect, test } from 'vitest';
import { moduleDataRef } from '../../../../src/services/git-source-history/module-data-service/moduleDataProtocol';
import {
	actor,
	outsider,
	project,
	unit,
	commit,
	projectionFixture
} from '../support/projectionFixture';

test('hosted projection cache avoids rebuilding unchanged GitHub snapshots and still checks membership', async () => {
	const f = projectionFixture(),
		query = { branch: 'feat/a/b', commit: null };
	const first = await f.projection.snapshot(actor, project.id, query);
	f.source.changed = async () => {
		throw Error('Unexpected projection rebuild');
	};
	expect(await f.projection.snapshot(actor, project.id, query)).toEqual(first);
	await expect(f.projection.snapshot(outsider, project.id, query)).rejects.toThrow();
	const original = f.source.optionalRef;
	f.source.optionalRef = async (repository, ref) =>
		ref === moduleDataRef
			? original(repository, ref)
			: { commit: '8'.repeat(40), tree: '7'.repeat(40) };
	await expect(f.projection.snapshot(actor, project.id, query)).rejects.toThrow(
		'Unexpected projection rebuild'
	);
});
test('cached entity metadata does not freeze comments at an older collaboration commit', async () => {
	const f = projectionFixture(),
		query = { entityId: unit.id, commit, branch: 'feat/a/b' };
	await f.projection.entity(actor, project.id, query);
	const anchor = {
		entityId: unit.id,
		branch: 'feat/a/b',
		commit,
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null
	};
	await f.api.addComment(actor, {
		projectId: project.id,
		requestId: crypto.randomUUID(),
		anchor,
		text: 'Review this page'
	});
	const shown = await f.projection.entity(actor, project.id, query);
	expect(shown.threadCount).toBe(1);
	const messages = await f.projection.messages(actor, project.id, {
		...query,
		threadId: shown.threads[0].id
	});
	expect(messages[0].text).toBe('Review this page');
});
