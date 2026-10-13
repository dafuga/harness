import { expect, test } from 'vitest';
import { hubPinnedSource } from '../../src/utils/hubPinnedSource';
import { actor, evidenceFixture, project, sourceAt } from '../support/evidenceFixture';

test('another commit of the repository is read as its own tree, while retaining requesting cache scope', async () => {
	const f = evidenceFixture();
	const base = await sourceAt(f, f.commits.changed);
	const { commit, path } = f.pointers.first;
	const at = await hubPinnedSource(base, commit);
	expect(at.commit).toBe(commit);
	expect(at.entries.map((entry) => entry.path)).toContain(`${path}/manifest.json`);
	expect(at.identity).toEqual({
		...{ principalId: actor.id, projectId: project.id, repositoryId: 1 },
		...{
			requestedRef: commit,
			sourceCommit: base.identity.sourceCommit,
			sourceTree: base.identity.sourceTree
		},
		...{
			notesRef: base.identity.notesRef,
			evidenceRef: base.identity.evidenceRef
		},
		...{ ...f.pins, historyIndexRevision: null },
		...{ collaborationRevision: null, artifactHash: null, profile: null }
	});
	expect([at.source, at.cache, at.repository]).toEqual([base.source, base.cache, base.repository]);
	expect(base.identity).toMatchObject({
		sourceCommit: f.commits.changed,
		...f.pins
	});
});

test('a commit the repository does not hold is not read', async () => {
	const f = evidenceFixture();
	const base = await sourceAt(f, f.commits.changed);
	await expect(hubPinnedSource(base, 'f'.repeat(40))).rejects.toMatchObject({
		code: 'github-unavailable'
	});
});
