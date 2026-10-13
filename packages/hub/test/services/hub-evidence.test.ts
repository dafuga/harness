import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import {
	actor,
	asked,
	evidenceFixture,
	outsider,
	project,
	read,
	refusal
} from '../support/evidenceFixture';
import { clock, page } from '../support/evidenceRecords';

test('the tip of a branch is shown alone, with what it was read at', async () => {
	const f = evidenceFixture();
	const { changed, root } = f.commits;
	const result = await read(f, asked(changed, 'verified', 'current'));
	expect([result.evidence.mode, result.evidence.before]).toEqual(['current', null]);
	expect(result.scope).toMatchObject({
		location: { branch: 'verified', commit: null, category: 'pages', entity: page },
		...{ mode: 'current', branch: 'verified', tip: changed, commit: changed, atTip: true },
		parent: root
	});
	expect(result.scope.summary).toMatchObject({
		...{ commit: changed, parents: [root], subject: 'feat: changed', author: 'Harness Fixture' },
		...{ committedAt: '2026-10-12T08:00:00Z', branches: ['verified'], coverage: 'verified' },
		gaps: [],
		records: [{ id: f.records.second.record.id, status: 'passed', valid: true }]
	});
	expect(result.identity).toMatchObject({
		principalId: actor.id,
		projectId: project.id,
		repositoryId: 1,
		sourceCommit: changed,
		sourceTree: f.git.tree(changed),
		...f.pins
	});
	const [shown] = result.evidence.after.captures;
	expect(result.evidence.after.captures).toHaveLength(1);
	expect(shown).toMatchObject({ usable: true, current: true, inheritedFrom: null });
	expect(shown.capture.media).toBe(`media/${shown.capture.sha256}.png`);
	expect(result.evidence.after.record?.id).toBe(f.records.second.record.id);
});

test('a commit is compared with its exact first parent, also when it is the tip', async () => {
	const f = evidenceFixture();
	const { changed, root } = f.commits;
	for (const branch of ['verified', 'main']) {
		const { scope, evidence } = await read(f, asked(changed, branch, 'commit'));
		expect(scope).toMatchObject({ mode: 'commit', atTip: branch === 'verified', parent: root });
		expect([scope.location.commit, scope.summary.branches]).toEqual([changed, [branch]]);
		expect(evidence.after).toMatchObject({ commit: changed, gap: null });
		expect(evidence.before).toMatchObject({ commit: root, gap: null });
		expect(evidence.before?.record?.id).toBe(f.records.first.record.id);
		expect(evidence.before?.captures).toHaveLength(1);
		expect(evidence.before?.captures[0].capture.sha256).not.toBe(
			evidence.after.captures[0].capture.sha256
		);
	}
});

test('a result inherited from an earlier record stays distinguishable from a run here', async () => {
	const f = evidenceFixture();
	const { changed, root } = f.commits;
	const query = asked(changed, 'main', 'commit', clock);
	const { evidence, behavior, scope } = await read(f, query);
	const origin = { commit: root, record: f.records.first.record.id };
	expect(scope.location.category).toBe('functions');
	expect(evidence.after.captures).toMatchObject([
		{ scenario: 'clock', standing: 'inherited', usable: true, current: false, inheritedFrom: root }
	]);
	expect(evidence.before?.captures).toMatchObject([
		{ scenario: 'clock', standing: 'fresh', usable: true, current: true, inheritedFrom: null }
	]);
	expect(evidence.after.record?.scenarios).toMatchObject([
		{ id: 'clock', status: 'referenced', inherited: true, origin }
	]);
	expect(evidence.after.coverage).toMatchObject([{ standing: 'passed', inheritedFrom: root }]);
	expect(behavior.summary).toBe('unchanged');
	expect(behavior.scenarios).toEqual([
		{ id: 'clock', title: 'Clock', before: 'passed', after: 'referenced' }
	]);
});

test('a commit without a record answers with its gap, and a first commit has no parent', async () => {
	const f = evidenceFixture();
	const unrecorded = await read(f, asked(f.commits.tip, 'main', 'current'));
	const gap = 'No verification record is attached to this commit.';
	expect(unrecorded.evidence.after).toMatchObject({ record: null, captures: [], gap });
	expect(unrecorded.scope.summary).toMatchObject({
		coverage: 'unverified',
		records: [],
		gaps: ['no verification record is attached to this commit']
	});
	const first = await read(f, asked(f.commits.root, 'main', 'commit'));
	expect([first.scope.parent, first.scope.summary.parents]).toEqual([null, []]);
	expect(first.evidence.before).toBeNull();
	expect(first.evidence.initial).toMatch(/first commit/);
	expect(first.evidence.after.captures).toHaveLength(1);
	expect(first.behavior.summary).toBe('not-compared');
});

test('what the history does not hold together is refused with its own code', async () => {
	const f = evidenceFixture();
	const { changed, side } = f.commits;
	// The change is in main and is not its tip: a view of the tip there is stale.
	expect(await refusal(read(f, asked(changed, 'main', 'current')))).toBe('evidence-stale');
	expect(await refusal(read(f, asked(side, 'verified', 'commit')))).toBe('evidence-unreadable');
	expect(await refusal(read(f, asked(changed, 'absent', 'commit')))).toBe('evidence-unreadable');
	const unknown = asked(changed, 'verified', 'current', 'page.unknown');
	expect(await refusal(read(f, unknown))).toBe('evidence-unreadable');
});

test('someone who is not a member is refused before the cache or the source is read', async () => {
	const f = evidenceFixture();
	const query = asked(f.commits.changed, 'verified', 'current');
	expect(await refusal(read(f, query, outsider))).toBe('forbidden');
	expect([f.calls, f.reads]).toEqual([[], []]);
	await read(f, query);
	const [calls, reads] = [f.calls.length, f.reads.length];
	expect(await refusal(read(f, query, outsider))).toBe('forbidden');
	expect([f.calls.length, f.reads.length]).toEqual([calls, reads]);
});
