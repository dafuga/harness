import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	findingOf,
	ledgerOf,
	measuredOf,
	measuredRepo,
	only,
	type Measured
} from './support/measuredRepo';
import { cloneRepo, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await measuredRepo();
}, 300_000);
afterAll(() => baseline.dispose());

test('a count of dependencies says what it could not read, and a complete count stays plain', async () => {
	const rows = await baseline.harnessJson<Measured[]>(['budget', 'measure']);
	const counted = (unit: string) => measuredOf(rows, unit, 'dependencies');
	// Nothing of the crate is read: not its Rust, and not the packages its manifest declares.
	const crate = counted('kernel.counter');
	expect(crate.value).toBeNull();
	expect(crate.unavailable).toMatch(
		/References are not read in Rust: crates\/counter\/src\/lib\.rs\./
	);
	expect(crate.unavailable).toMatch(
		/Packages declared in crates\/counter\/Cargo\.toml are not counted\./
	);
	// What was read is counted, and the number says what it leaves out.
	const mixed = counted('kernel.mixed');
	expect([mixed.value, mixed.unavailable]).toEqual([1, undefined]);
	expect(mixed.partial).toMatch(/References are not read in Rust: crates\/mixed\/src\/lib\.rs\./);
	const dynamic = counted('function.loader');
	expect([dynamic.value, dynamic.partial]).toEqual([
		0,
		'1 reference could not be resolved in src/utils/loader.ts.'
	]);
	// Controls: every reference read and resolved, and a unit that refers to nothing.
	const plain = ['function.reader', 'function.constants'].map(counted);
	expect(plain.map((row) => [row.unit, row.value, row.unavailable, row.partial])).toEqual([
		['function.reader', 3, undefined, undefined],
		['function.constants', 0, undefined, undefined]
	]);
});

test('the baseline and the gate treat a count of dependencies by what was read', async () => {
	const ledger = await ledgerOf(baseline);
	const frozen = (unit: string) => only(ledger, (line) => line.unit === unit, unit);
	expect(frozen('kernel.counter').metrics.dependencies).toBeUndefined();
	expect(frozen('kernel.counter').unmeasured?.dependencies).toMatch(/Cargo\.toml are not counted/);
	expect([
		frozen('kernel.mixed').metrics.dependencies,
		frozen('function.reader').metrics.dependencies
	]).toEqual([1, 3]);

	const repo = await cloneRepo(baseline);
	await repo.change('crates/counter/src/lib.rs', (text) => text.replace('value < 0', 'value > 0'));
	const stated = await repo.verify();
	expect(findingOf(stated.record.budgets.findings, 'kernel.counter', 'dependencies')).toMatchObject(
		{
			status: 'unavailable',
			detail: expect.stringMatching(/References are not read in Rust/)
		}
	);
	// One more module read in the counted file of a mixed unit, and in a fully read unit.
	await repo.change(
		'crates/mixed/bindings.ts',
		(text) => `import { EOL } from 'node:os';\n${text}`
	);
	await repo.change('src/utils/reader.ts', (text) => `import { EOL } from 'node:os';\n${text}`);
	const grown = await repo.verify();
	const [mixed, read] = ['kernel.mixed', 'function.reader'].map((unit) =>
		findingOf(grown.record.budgets.findings, unit, 'dependencies')
	);
	expect([mixed.status, mixed.baseline, mixed.measured]).toEqual(['exceeded', 1, 2]);
	expect(mixed.detail).toMatch(/References are not read in Rust/);
	expect([read.status, read.baseline, read.measured, read.detail]).toEqual([
		'exceeded',
		3,
		4,
		undefined
	]);
	await repo.dispose();
}, 300_000);
