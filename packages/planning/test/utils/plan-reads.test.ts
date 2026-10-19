import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { planningService } from '../../src/services/planning-service/PlanningService';
import { readImage } from '../../src/utils/plan-design/planDesign';
import { planGit } from '../../src/index/planGit';
import { revision, type Git } from '../../src/utils/planGit';
import { planRead } from '../../src/utils/plan-read/planRead';
import { author, contract, fixture, git as shell } from '../planFixture';
import { recordCapture } from '../../../../src/utils/record-capture/recordCapture';

/**
 * One planning operation runs each read pinned to a commit once, and answers exactly as the same
 * reads made one by one do. The next operation reads again, so it sees approvals, new commits
 * and a branch that moved.
 */
async function counting(root: string) {
	const git = await planGit(root);
	const calls: string[][] = [];
	const run: Git['run'] = (args, input, env) => {
		calls.push(args);
		return git.run(args, input, env);
	};
	return { git: { ...git, run }, calls };
}
const pinnedReads = (calls: string[][]) =>
	calls.filter(([command]) => command === 'show' || command === 'ls-tree').map((c) => c.join(' '));
const repeated = (reads: string[]) => reads.length - new Set(reads).size;
type Case = { name: string; input: unknown; output: unknown };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const trace = (file: string, cases: Case[]) =>
	recordCapture(
		{
			evidence: 'planning-artifacts-reads',
			kind: 'trace',
			state: 'operation-read-isolation',
			file,
			mediaType: 'application/json'
		},
		JSON.stringify(
			{
				schemaVersion: 1,
				kind: 'function-invocations',
				unitId: 'planning.function.plan-reads',
				symbol: 'planReads',
				cases
			},
			null,
			'\t'
		)
	);
async function designed() {
	const { root, api } = await fixture();
	await api.createPlan({
		category: 'page',
		slug: 'home',
		title: 'Home',
		goal: 'A home page',
		author,
		contract
	});
	const bytes = PNG.sync.write(new PNG({ width: 2, height: 2 }));
	const design = await api.addDesign({
		unitId: 'page.home',
		prompt: 'Home',
		generator: { provider: 'codex', model: 'selected' },
		images: [{ state: 'default', viewport: 'desktop', bytes }]
	});
	return { root, api, design };
}

test('one operation runs each pinned read once and answers as reads made one by one', async () => {
	const { root, design } = await designed();
	const raw = await counting(root);
	const head = await revision(raw.git);
	const expected = await planRead(raw.git, head, 'page.home');
	const counted = await counting(root);
	const api = planningService(counted.git);
	expect(await api.readPlan({ unitId: 'page.home' })).toEqual(expected);
	expect(repeated(pinnedReads(raw.calls))).toBeGreaterThan(0);
	expect(repeated(pinnedReads(counted.calls))).toBe(0);
	expect(counted.calls.length).toBeLessThan(raw.calls.length);
	const reads = (calls: string[][]) => ({
		gitCalls: calls.length,
		pinnedReads: pinnedReads(calls).length,
		repeatedPinnedReads: repeated(pinnedReads(calls))
	});
	const readPlanOnly = { operation: reads(counted.calls), oneByOne: reads(raw.calls) };
	const image = { unitId: 'page.home', version: 'v001', file: design.value.images[0].file };
	expect(await api.readImage(image)).toEqual(await readImage(raw.git, image));
	trace('plan-reads-operation.json', [
		{
			name: 'readPlan in one operation',
			input: { unitId: 'page.home' },
			output: readPlanOnly.operation
		},
		{
			name: 'the same reads one by one',
			input: { unitId: 'page.home' },
			output: readPlanOnly.oneByOne
		}
	]);
}, 30000);

test('each operation reads again: it sees an approval, a new commit and a branch that moved', async () => {
	const { root, design } = await designed();
	const raw = (await counting(root)).git;
	const truth = async () => planRead(raw, await revision(raw), 'page.home');
	const api = planningService((await counting(root)).git);
	const cases: Case[] = [];
	const look = (name: string, plan: unknown) =>
		cases.push({
			name,
			input: { unitId: 'page.home', head: shell(root, 'rev-parse', 'HEAD') },
			output: { plan: digest(plan) }
		});
	const before = await api.readPlan({ unitId: 'page.home' });
	look('before an approval', before);
	expect(before).toEqual(await truth());
	await api.approveDesign({
		unitId: 'page.home',
		version: 'v001',
		images: design.value.images.map((image) => ({ file: image.file, sha256: image.sha256 })),
		contractHash: design.value.contractHash,
		reviewer: 'Reviewer'
	});
	const approved = await api.readPlan({ unitId: 'page.home' });
	look('after the approval', approved);
	expect(approved).not.toEqual(before);
	expect(approved).toEqual(await truth());
	shell(root, 'checkout', '-q', '-b', 'earlier', design.commit);
	expect(await api.readPlan({ unitId: 'page.home' })).toEqual(before);
	shell(root, 'checkout', '-q', 'main');
	shell(root, 'commit', '-q', '--allow-empty', '-m', 'external commit');
	const moved = await api.readPlan({ unitId: 'page.home' });
	look('after an external commit', moved);
	expect(moved).toEqual(await truth());
	trace('plan-reads-freshness.json', cases);
}, 30000);
