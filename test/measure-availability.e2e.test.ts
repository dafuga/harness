import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	complexityOf,
	findingOf,
	indexedPoint,
	ledgerOf,
	manifest,
	measuredRepo,
	only,
	rust,
	type Measured
} from './support/measuredRepo';
import { cloneRepo, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await measuredRepo();
}, 300_000);
afterAll(() => baseline.dispose());

test('complexity nobody counted is stated as unavailable or partial, and a counted zero stays zero', async () => {
	const rows = await baseline.harnessJson<Measured[]>(['budget', 'measure']);
	// Rust and Python are not parsed: no number is claimed, and the reason names what was skipped.
	const counter = complexityOf(rows, 'kernel.counter');
	expect(counter.value).toBeNull();
	expect(counter.unavailable).toMatch(/not counted in Rust/);
	expect(counter.unavailable).toContain('crates/counter/src/lib.rs');
	const report = complexityOf(rows, 'script.report');
	expect([report.value, report.unavailable]).toEqual([null, expect.stringMatching(/Python/)]);
	// What can be counted in a unit is counted, and the unit says what its number leaves out.
	const mixed = complexityOf(rows, 'kernel.mixed');
	expect([mixed.value, mixed.unavailable]).toEqual([3, undefined]);
	expect(mixed.partial).toMatch(/crates\/mixed\/src\/lib\.rs/);
	// Controls carry no caveat: a counted zero, and one function without a branch, which is one.
	const counted = ['function.constants', 'function.slugify'].map((unit) =>
		complexityOf(rows, unit)
	);
	expect(counted.map((row) => [row.unit, row.value, row.unavailable, row.partial])).toEqual([
		['function.constants', 0, undefined, undefined],
		['function.slugify', 1, undefined, undefined]
	]);
	// Size does not depend on the language and is measured everywhere.
	const bytes = only(
		rows,
		(row) => row.unit === 'kernel.counter' && row.metric === 'source-bytes',
		'bytes'
	);
	expect(bytes.value).toBe(Buffer.byteLength(rust) + Buffer.byteLength(manifest));
});

test('a baseline freezes what was measured and records what was not, and both are enforced as such', async () => {
	const ledger = await ledgerOf(baseline);
	const frozen = (unit: string) => only(ledger, (line) => line.unit === unit, unit);
	// No zero is frozen for Rust: the ledger says complexity was unavailable, and why.
	expect(frozen('kernel.counter').metrics.complexity).toBeUndefined();
	expect(frozen('kernel.counter').unmeasured).toMatchObject({
		complexity: expect.stringMatching(/Rust/)
	});
	expect(frozen('kernel.mixed').metrics.complexity).toBe(3);
	const zero = frozen('function.constants');
	expect([zero.metrics.complexity, zero.unmeasured]).toEqual([0, undefined]);

	const repo = await cloneRepo(baseline);
	// The same number of bytes, so only complexity is in question in each unit.
	await repo.change('crates/counter/src/lib.rs', (text) => text.replace('value < 0', 'value > 0'));
	const unjudged = await repo.verify();
	expect([unjudged.record.status, unjudged.record.failures]).toEqual(['passed', []]);
	expect(findingOf(unjudged.record.budgets.findings, 'kernel.counter')).toMatchObject({
		status: 'unavailable',
		baseline: null,
		measured: null,
		detail: expect.stringMatching(/Rust/)
	});
	const stated = only(
		unjudged.record.measurements,
		(item) => item.unit === 'kernel.counter' && item.metric === 'complexity',
		'the recorded measurement'
	);
	expect([stated.value, stated.unavailable]).toEqual([null, expect.stringMatching(/Rust/)]);

	// The history index keeps the metric absent at that commit and carries the reason.
	const point = await indexedPoint(repo, unjudged.record.id);
	expect(point.complexity).toBeUndefined();
	expect(point.notes).toMatchObject({ complexity: expect.stringMatching(/Rust/) });
	expect(point['source-bytes']).toBeGreaterThan(0);

	// Counted code is still frozen: in the counted part of a mixed unit, and at zero.
	await repo.change('crates/mixed/bindings.ts', (text) =>
		text.replace('return 0;', 'return value ? 1 : 0;')
	);
	await repo.change('src/utils/constants.ts', () => 'export const limit = 1 ? 2 : 3;\n');
	const grown = await repo.verify();
	expect(grown.record.status).toBe('failed');
	const [mixed, constants] = ['kernel.mixed', 'function.constants'].map((unit) =>
		findingOf(grown.record.budgets.findings, unit)
	);
	expect([mixed.status, mixed.baseline, mixed.measured]).toEqual(['exceeded', 3, 4]);
	expect([constants.status, constants.baseline, constants.measured]).toEqual(['exceeded', 0, 1]);
	expect(grown.record.failures).toContain(
		'kernel.mixed: complexity grew from 3 to 4 without a recorded approval'
	);
	await repo.dispose();
}, 300_000);
