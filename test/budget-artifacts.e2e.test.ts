import { afterAll, beforeAll, expect, test } from 'vitest';
import { emitted, emittedRepo, events, ledger, resized, targets } from './support/emittedRepo';
import { cloneRepo, reviewer, type VerifyRepo } from './support/verifyRepo';

/**
 * What a unit emits has a frozen size of its own for every execution target, beside the limits
 * on its source. The fixture builds slugify for a process (3 bytes) and for Wasm (5 bytes) from
 * digits in a comment, so an output grows while the source keeps its size.
 */
let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await emittedRepo();
}, 180_000);
afterAll(() => baseline.dispose());

const unit = 'function.slugify';
const gates = { snapshot: 'passed', tests: 'passed', reasons: 'passed' };
const source = (record: { budgets: { findings: Array<{ unit: string; metric: string }> } }) =>
	record.budgets.findings.find((item) => item.unit === unit && item.metric === 'source-bytes');

test('the first baseline freezes each emitted size by itself, beside the source limits', async () => {
	const [first] = await events(baseline, unit);
	expect(first.type).toBe('baseline');
	expect(first.metrics).toMatchObject({ 'artifact-bytes:process': 3, 'artifact-bytes:wasm': 5 });
	expect(Object.keys(first.metrics ?? {}).sort()).toEqual([
		'artifact-bytes:process',
		'artifact-bytes:wasm',
		'complexity',
		'dependencies',
		'source-bytes'
	]);
	// A module emits nothing: there is no limit for it, and no zero either.
	const [title] = await events(baseline, 'service.title');
	expect(Object.keys(title.metrics ?? {}).some((key) => key.startsWith('artifact-bytes'))).toBe(
		false
	);
});

test('one target that grows fails without approval, although the source kept its size and the other target shrank by as much', async () => {
	const repo = await cloneRepo(baseline);
	// Seven and one: the two outputs together weigh what they weighed, eight bytes.
	await resized(repo, 'slugify', 'p7 w1');
	const blocked = await repo.verify();
	expect([blocked.exitCode, blocked.record.status]).toEqual([1, 'failed']);
	expect(blocked.record.gates).toMatchObject({ ...gates, budgets: 'failed' });
	expect(blocked.record.failures).toEqual([
		`${unit}: artifact-bytes of the process target grew from 3 to 7 without a recorded approval`
	]);
	expect(source(blocked.record)).toMatchObject({ status: 'passed' });
	expect(emitted(blocked.record, unit)).toEqual({
		process: expect.objectContaining({ status: 'exceeded', baseline: 3, measured: 7 }),
		wasm: expect.objectContaining({ status: 'passed', baseline: 5, measured: 1 })
	});
	const sized = blocked.record.measurements.filter(
		(item) => item.unit === unit && item.metric === 'artifact-bytes'
	);
	expect(sized.map((item) => [item.target, item.value, item.artifacts[0].sha256.length])).toEqual([
		['process', 7, 64],
		['wasm', 1, 64]
	]);

	// A reviewed approval is the only way on, and it stays in the ledger with both sides.
	await repo.harness(['budget', 'approve', unit, '--record', blocked.record.id, ...reviewer]);
	await repo.commit('chore: approve the larger process output');
	const approved = await repo.verify();
	expect([approved.exitCode, approved.record.failures]).toEqual([0, []]);
	const [first, approval] = await events(repo, unit);
	expect([first.type, approval.type]).toEqual(['baseline', 'approval']);
	expect(approval.before).toMatchObject({ 'artifact-bytes:process': 3, 'artifact-bytes:wasm': 5 });
	expect(approval.after).toMatchObject({ 'artifact-bytes:process': 7, 'artifact-bytes:wasm': 1 });
	const history = await repo.harness(['budget', 'history', unit, '--json']);
	expect((JSON.parse(history.stdout) as unknown[]).length).toBe(2);

	// The approved size is the limit now: the Wasm output may not return to what it was.
	await resized(repo, 'slugify', 'p7 w5');
	const again = await repo.verify();
	expect(again.record.failures).toEqual([
		`${unit}: artifact-bytes of the wasm target grew from 1 to 5 without a recorded approval`
	]);
	await repo.dispose();
}, 240_000);

test('an output that was measured at its baseline and is no longer built fails', async () => {
	const repo = await cloneRepo(baseline);
	await resized(repo, 'slugify', 'p3 w0');
	const { record, exitCode } = await repo.verify();
	expect(exitCode).toBe(1);
	expect(record.gates).toMatchObject({ ...gates, budgets: 'failed' });
	expect(record.failures).toEqual([
		`${unit}: artifact-bytes of the wasm target was 5 at its baseline and can no longer be measured: ` +
			'artifacts/slugify.wasm was not built in the verified snapshot.'
	]);
	expect(emitted(record, unit)).toEqual({
		process: expect.objectContaining({ status: 'passed', baseline: 3, measured: 3 }),
		wasm: expect.objectContaining({ status: 'missing-measurement', baseline: 5, measured: null })
	});
	await repo.dispose();
}, 180_000);

test('an output that could not be built when the limits were reviewed is stated, and needs a reviewed limit once it is built', async () => {
	const clock = 'function.clock';
	const [first] = await events(baseline, clock);
	expect(first.unmeasured).toEqual({
		'artifact-bytes:wasm': 'artifacts/clock.wasm was not built in the verified snapshot.'
	});
	const repo = await cloneRepo(baseline);
	// Still not built: stated, not judged, and no other limit is disturbed.
	await repo.change('src/utils/clock.ts', (text) => text.replaceAll('value', 'input'));
	const stated = await repo.verify();
	expect([stated.exitCode, stated.record.failures]).toEqual([0, []]);
	expect(emitted(stated.record, clock).wasm).toMatchObject({
		status: 'unavailable',
		measured: null,
		baseline: null
	});

	await resized(repo, 'clock', 'c4');
	const built = await repo.verify();
	expect(built.record.failures).toEqual([
		`${clock}: artifact-bytes of the wasm target could not be measured when its limits were reviewed and is 4 now; a reviewer must approve a limit`
	]);
	await repo.harness(['budget', 'approve', clock, '--record', built.record.id, ...reviewer]);
	await repo.commit('chore: freeze the clock output');
	expect((await repo.verify()).record.failures).toEqual([]);
	const approval = (await events(repo, clock))[1];
	expect(approval.after).toMatchObject({ 'artifact-bytes:wasm': 4 });
	expect(approval.unmeasured).toBeUndefined();
	expect(await repo.read(ledger)).toContain('"artifact-bytes:wasm":4');
	await repo.dispose();
}, 240_000);

test('an output a unit starts to emit after its baseline needs a reviewed limit before it passes', async () => {
	const title = 'service.title';
	const repo = await cloneRepo(baseline);
	await targets(repo, title, [{ kind: 'wasm', entry: 'artifacts/title.wasm' }]);
	const config = await repo.json<{ setup: Array<{ command: string }> }>('harness.verify.json');
	const command = `${config.setup[0].command}; head -c 2 /dev/zero > artifacts/title.wasm`;
	await repo.write('harness.verify.json', JSON.stringify({ ...config, setup: [{ command }] }));
	await repo.harness(['units', 'index', '--write']);
	await repo.explainAll();
	await repo.commit('feat: the title service is built for Wasm');
	const blocked = await repo.verify();
	expect(blocked.record.gates).toMatchObject({ ...gates, budgets: 'failed' });
	expect(blocked.record.failures).toEqual([
		`${title}: artifact-bytes of the wasm target is 2 and has no frozen limit: the baseline of the unit does not cover this output; a reviewer must approve a limit`
	]);
	// The limits the unit already had are judged as before, and stay.
	expect(emitted(blocked.record, unit).process).toMatchObject({ status: 'passed', baseline: 3 });
	await repo.harness(['budget', 'approve', title, '--record', blocked.record.id, ...reviewer]);
	await repo.commit('chore: freeze the title output');
	expect((await repo.verify()).record.failures).toEqual([]);
	const approval = (await events(repo, title))[1];
	expect(approval.before).not.toHaveProperty('artifact-bytes:wasm');
	expect(approval.after).toMatchObject({ 'artifact-bytes:wasm': 2 });
	await repo.dispose();
}, 240_000);
