import { expect } from '../../../../test/verificationExpect';
import { afterAll, beforeAll, test } from 'vitest';
import { explorerBehavior } from '../../../reports/src/utils/explorerBehavior';
import { explorerEvidence } from '../../../reports/src/utils/explorerEvidence';
import { explorerVerdict } from '../../../reports/src/utils/explorer-verdict/explorerVerdict';
import {
	asked,
	clock,
	git,
	opened,
	page,
	recordedRepo,
	type At,
	type Opened,
	type Recorded
} from '../recorded-evidence-fixture';
import { held } from '../recorded-sample';

let f: Recorded;
let reader: Opened;
beforeAll(async () => {
	f = await recordedRepo();
	reader = await opened(f.root);
}, 240_000);
afterAll(() => f.repo.dispose());

const tip = () => ({ commit: f.commits.changed, branch: 'verified', mode: 'current' as const });
const within = () => ({ commit: f.commits.changed, branch: 'main', mode: 'commit' as const });

test('the tip of a branch is shown alone, with what it was read at', async () => {
	const result = await reader.evidence(asked(reader, page, tip()));
	const { changed, baseline } = f.commits;
	expect([result.evidence.mode, result.evidence.before]).toEqual(['current', null]);
	expect(result.scope).toMatchObject({
		location: { branch: 'verified', commit: null, category: 'pages', entity: page },
		mode: 'current',
		branch: 'verified',
		tip: changed,
		commit: changed,
		atTip: true,
		parent: baseline
	});
	expect(result.scope.summary).toMatchObject({
		commit: changed,
		parents: [baseline],
		subject: 'feat: change src/utils/slugify.ts',
		author: 'Harness Fixture',
		committedAt: git(f.root, 'show', '-s', '--format=%cI', changed),
		branches: ['verified'],
		coverage: 'verified',
		gaps: [],
		records: [{ id: result.evidence.after.record?.id, status: 'passed', valid: true }]
	});
	expect(result.identity).toMatchObject({
		projectId: reader.projectId,
		requestedRef: 'verified',
		sourceCommit: changed,
		sourceTree: git(f.root, 'rev-parse', `${changed}^{tree}`),
		notesRevision: git(f.root, 'rev-parse', 'refs/notes/harness'),
		evidenceRevision: git(f.root, 'rev-parse', 'refs/heads/harness-evidence')
	});
	const { captures } = result.evidence.after;
	expect(captures).toHaveLength(6);
	for (const item of captures) {
		const media = `media/${item.capture.sha256}.png`;
		expect(item).toMatchObject({ usable: true, current: true, inheritedFrom: null });
		expect(item.capture).toMatchObject({ kind: 'screenshot', status: 'passed', media });
	}
}, 60_000);

test('a commit is compared with its exact first parent, also when it is the tip', async () => {
	const { changed, baseline, merged } = f.commits;
	for (const branch of ['verified', 'main']) {
		const at = { commit: changed, branch, mode: 'commit' as const };
		const { scope, evidence } = await reader.evidence(asked(reader, page, at));
		expect(scope).toMatchObject({ mode: 'commit', atTip: branch === 'verified', parent: baseline });
		expect([scope.location.commit, scope.summary.branches]).toEqual([changed, [branch]]);
		expect(evidence.after).toMatchObject({ commit: changed, gap: null });
		expect(evidence.before).toMatchObject({ commit: baseline, gap: null });
		expect(evidence.before?.record?.source.commit).toBe(baseline);
		expect(evidence.before?.captures).toHaveLength(6);
	}
	const merge = { commit: merged, branch: 'merged', mode: 'commit' as const };
	const { scope, evidence } = await reader.evidence(asked(reader, page, merge));
	expect(scope.summary.parents).toEqual([changed, f.commits.failed]);
	expect([scope.parent, evidence.before?.commit]).toEqual([changed, changed]);
	expect(evidence.before?.record?.source.commit).toBe(changed);
	expect(evidence.after).toMatchObject({ record: null, captures: [] });
}, 60_000);

test('a result inherited from an earlier record is not shown as one run at this commit', async () => {
	const { evidence, behavior } = await reader.evidence(asked(reader, clock, within()));
	const origin = { commit: f.commits.baseline, record: evidence.before?.record?.id };
	expect(evidence.after.captures).toMatchObject([
		{ scenario: 'clock', standing: 'inherited', usable: true, current: false }
	]);
	expect(evidence.after.captures[0].inheritedFrom).toBe(f.commits.baseline);
	expect(evidence.before?.captures).toMatchObject([
		{ scenario: 'clock', standing: 'fresh', usable: true, current: true, inheritedFrom: null }
	]);
	expect(evidence.after.record?.scenarios).toMatchObject([
		{ id: 'clock', status: 'referenced', inherited: true, origin }
	]);
	expect(evidence.after.coverage).toMatchObject([{ inheritedFrom: f.commits.baseline }]);
	expect(behavior.summary).toBe('unchanged');
	expect(behavior.scenarios).toEqual([
		{ id: 'clock', title: 'clock scenario', before: 'passed', after: 'referenced' }
	]);
}, 60_000);

test('a commit without a record answers with its gap, and a first commit has no parent', async () => {
	const head = { commit: f.commits.unverified, branch: 'main', mode: 'current' as const };
	const unrecorded = await reader.evidence(asked(reader, page, head));
	const gap = 'No verification record is attached to this commit.';
	expect(unrecorded.evidence.after).toMatchObject({ record: null, captures: [], gap });
	expect(unrecorded.scope.summary).toMatchObject({
		coverage: 'unverified',
		records: [],
		gaps: ['no verification record is attached to this commit']
	});
	const first = { commit: f.commits.failed, branch: 'main', mode: 'commit' as const };
	const root = await reader.evidence(asked(reader, clock, first));
	expect([root.scope.parent, root.scope.summary.parents]).toEqual([null, []]);
	expect(root.scope.summary).toMatchObject({ coverage: 'failed', records: [{ status: 'failed' }] });
	expect(root.evidence.before).toBeNull();
	expect(root.evidence.initial).toMatch(/first commit/);
	expect(root.evidence.after.captures).toHaveLength(1);
	expect(root.behavior.summary).toBe('not-compared');
}, 60_000);

test('what the history does not hold together is refused, and nothing else is shown', async () => {
	const refused = (entity: string, at: Partial<At> = {}) =>
		reader.evidence(asked(reader, entity, { ...tip(), ...at }));
	await expect(refused('page.unknown')).rejects.toThrow(/not registered/);
	await expect(refused(page, { branch: 'absent' })).rejects.toThrow(/local branch/);
	await expect(refused(page, { branch: 'verified~0' })).rejects.toThrow(/local branch/);
	// The change is in main, and is not its tip: that view is stale.
	await expect(refused(page, { branch: 'main' })).rejects.toThrow(/no longer the tip/);
	const off = { commit: f.commits.unverified, mode: 'commit' as const };
	await expect(refused(page, off)).rejects.toThrow(/outside the selected branch/);
	const other = { ...asked(reader, page, tip()), projectId: `local-${'0'.repeat(64)}` };
	await expect(reader.evidence(other)).rejects.toThrow('The requested project is not selected.');
}, 60_000);

test('the answer holds this entity alone and still derives itself', async () => {
	const result = await reader.evidence(asked(reader, page, within()));
	const { after, before } = result.evidence;
	for (const side of [after, before]) {
		const own = held(side);
		expect([own.units, own.scenarios, own.ran]).toEqual([[page], ['titles-page'], ['titles-page']]);
		expect([own.available, own.edges]).toEqual([true, []]);
		expect([...new Set([page, ...own.measured])]).toEqual([page]);
	}
	const text = JSON.stringify(result);
	for (const foreign of ['spoken.wav', 'clock.txt', 'benchmark.json', f.root])
		expect(text).not.toContain(foreign);
	expect(text.length).toBeLessThan(60_000);
	const [head, parent] = [held(after).detail, held(before).detail];
	expect(explorerEvidence(result.scope, { head, parent }, { id: page })).toEqual(result.evidence);
	expect(explorerBehavior(result.evidence)).toEqual(result.behavior);
	expect(explorerVerdict(head.registry.units[0], head)).toEqual({
		passed: true,
		label: 'Full coverage passed',
		reasons: []
	});
}, 60_000);
