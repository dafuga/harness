import { afterAll, beforeAll, expect, test } from 'vitest';
import { baselineRepo, cloneRepo, reviewer, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

const ledger = 'specification/budgets/ledger.ndjson';
const finding = (record: { budgets: { findings: Finding[] } }, unit: string, metric: string) =>
	record.budgets.findings.find((item) => item.unit === unit && item.metric === metric);
interface Finding {
	unit: string;
	metric: string;
	status: string;
	baseline: number | null;
	measured: number | null;
}
const grow = (source: string) =>
	source.replace(
		'\treturn input',
		"\tif (input.length > 99 || input.includes('?')) return input;\n\treturn input"
	);

test('a new unit needs a reviewer to establish its baseline from a clean passing record', async () => {
	const repo = await cloneRepo(baseline);
	await repo.write('src/utils/extra.ts', 'export function extra(): number {\n\treturn 1;\n}\n');
	await repo.write(
		'test/utils/extra.test.ts',
		"import { extra } from '../../src/utils/extra';\n\nexport const subject = extra;\n"
	);
	await repo.harness(['units', 'index', '--write']);
	await repo.explainAll();
	await repo.commit('feat: add extra');
	const blocked = await repo.verify();
	expect([blocked.exitCode, blocked.record.status]).toEqual([1, 'failed']);
	expect(finding(blocked.record, 'function.extra', 'source-bytes')).toEqual({
		unit: 'function.extra',
		metric: 'source-bytes',
		status: 'missing-baseline',
		baseline: null,
		measured: 47
	});
	expect(blocked.record.failures).toContain(
		'function.extra: no baseline is established; a reviewer must establish one'
	);

	const establish = ['budget', 'establish', 'function.extra', '--record', blocked.record.id];
	const self = await repo.run([...establish, '--reviewer', 'Harness Fixture', '--reason', 'mine']);
	expect(self.exitCode).toBe(1);
	expect(self.stderr).toContain('reviewer cannot be the author of the measured change');
	const anonymous = await repo.run([...establish, '--reviewer', ' ', '--reason', 'x']);
	expect(anonymous.stderr).toContain('--reviewer');
	const unknown = await repo.run([
		'budget',
		'establish',
		'function.extra',
		'--record',
		'package.json',
		...reviewer
	]);
	expect(unknown.stderr).toContain('is not a verification record');

	await repo.harness([...establish, ...reviewer]);
	await repo.commit('chore: baseline for extra');
	const passed = await repo.verify();
	expect(passed.record.failures).toEqual([]);
	expect(passed.exitCode).toBe(0);
	await repo.dispose();
}, 180_000);

test('size and complexity are frozen until a reviewer approves the new limits', async () => {
	const repo = await cloneRepo(baseline);
	await repo.change('src/utils/slugify.ts', grow);
	const blocked = await repo.verify();
	expect(blocked.exitCode).toBe(1);
	expect(finding(blocked.record, 'function.slugify', 'source-bytes')).toMatchObject({
		status: 'exceeded',
		baseline: 100,
		measured: 161
	});
	expect(finding(blocked.record, 'function.slugify', 'complexity')).toMatchObject({
		status: 'exceeded',
		baseline: 1,
		measured: 3
	});
	expect(blocked.record.failures).toContain(
		'function.slugify: source-bytes grew from 100 to 161 without a recorded approval'
	);

	const before = await repo.read(ledger);
	await repo.write(ledger, before.replace('"source-bytes":100', '"source-bytes":999'));
	await repo.commit('chore: quietly raise the limit');
	const rewritten = await repo.verify();
	expect(rewritten.record.failures).toContain(
		'budget ledger was rewritten; recorded baselines and approvals are append-only'
	);
	await repo.write(ledger, before);
	await repo.commit('chore: restore ledger');

	const approve = ['budget', 'approve', 'function.slugify', '--record', blocked.record.id];
	await repo.harness([...approve, ...reviewer]);
	await repo.commit('chore: approve slugify growth');
	const passed = await repo.verify();
	expect(passed.record.failures).toEqual([]);
	const history = JSON.parse(
		(await repo.run(['budget', 'history', 'function.slugify', '--json'])).stdout
	) as Array<{ type: string; reviewer: string; reason: string; before?: object; after?: object }>;
	expect(history.map((event) => event.type)).toEqual(['baseline', 'approval']);
	expect(history[1]).toMatchObject({
		reviewer: 'Reviewer One',
		reason: 'Reviewed fixture change',
		before: { 'source-bytes': 100, complexity: 1 },
		after: { 'source-bytes': 161, complexity: 3 }
	});
	expect(await repo.read(ledger)).toContain(before.trim());
	await repo.dispose();
}, 240_000);

test('retiring and recreating a unit cannot reset its budget, and identities cannot vanish', async () => {
	const repo = await cloneRepo(baseline);
	const source = grow(await repo.read('src/utils/slugify.ts'));
	await repo.git(['rm', '-q', 'src/utils/slugify.ts']);
	await repo.harness(['units', 'retire', 'function.slugify', '--reason', 'Moved']);
	await repo.write('src/core/slug.ts', source);
	await repo.write(
		'src/services/TitleService.ts',
		(await repo.read('src/services/TitleService.ts')).replace('../utils/slugify', '../core/slug')
	);
	await repo.harness(['units', 'index', '--write']);
	await repo.explainAll();
	await repo.commit('feat: recreate slugify elsewhere');

	const blocked = await repo.verify();
	expect(finding(blocked.record, 'function.slug', 'source-bytes')).toMatchObject({
		status: 'exceeded',
		baseline: 100,
		measured: 161
	});
	const establish = await repo.run([
		'budget',
		'establish',
		'function.slug',
		'--record',
		blocked.record.id,
		...reviewer
	]);
	expect(establish.exitCode).toBe(1);
	expect(establish.stderr).toContain('inherits the baseline of function.slugify');

	await repo.git(['rm', '-q', 'specification/units/function.slugify.json']);
	const lineage = 'specification/units/function.slug.json';
	const manifest = await repo.json<Record<string, unknown>>(lineage);
	await repo.write(lineage, JSON.stringify({ ...manifest, lineage: undefined }));
	await repo.commit('chore: drop the tombstone');
	const vanished = await repo.verify();
	expect(vanished.record.failures).toContain(
		'unit function.slugify was removed from the registry; identities may only be retired'
	);
	await repo.dispose();
}, 240_000);
