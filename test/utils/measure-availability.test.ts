import { expect, test } from 'vitest';
import type { BudgetEvent } from '../../src/core/budgetTypes';
import type { SourceTree } from '../../src/core/sourceTypes';
import type { ComponentManifest } from '../../src/core/unitTypes';
import { defaultUnitsConfig } from '../../src/core/unitsConfig';
import { BudgetService } from '../../src/services/BudgetService';
import { SourceIndexService } from '../../src/services/SourceIndexService';
import { budgetFindings } from '../../src/utils/budgetFindings';
import { complexityCoverage } from '../../src/utils/complexityCoverage';
import { unitMeasurements } from '../../src/utils/unitMeasurements';

const commit = 'a'.repeat(40);
const sources: Record<string, string> = {
	'src/utils/pick.ts':
		'export function pick(value: number) {\n\treturn value > 1 ? value : 0;\n}\n',
	'src/utils/constants.ts': 'export const limit = 10;\n',
	'crates/counter/src/lib.rs': 'pub fn sign(v: i32) -> i32 { if v < 0 { -1 } else { 1 } }\n',
	'crates/counter/Cargo.toml': '[package]\nname = "counter"\n',
	'crates/counter/bindings.ts': 'export const bound = (v: number) => (v && v > 1 ? v : 0);\n',
	'crates/blob/data.bin': 'not text'
};
const tree: SourceTree = {
	revision: 'working-tree',
	list: () =>
		Promise.resolve(Object.keys(sources).map((path) => ({ path, hash: commit.replace('a', 'b') }))),
	read: (path) => Promise.resolve(sources[path])
};
const unit = (id: string, source: string[]) =>
	({
		id,
		owns: { source },
		dependencies: [],
		runtime: { targets: [] }
	}) as unknown as ComponentManifest;
const complexity = async (id: string, source: string[]) => {
	const index = await new SourceIndexService().index(tree, defaultUnitsConfig);
	const rows = unitMeasurements(unit(id, source), index.files, commit);
	return rows.filter((row) => row.metric === 'complexity' || row.metric === 'source-bytes');
};

test('only what is counted, or cannot decide anything, yields a number of decision points', () => {
	const covered = (path: string, scripted = false) => complexityCoverage(path, scripted);
	expect(['a.ts', 'a.svelte', 'a.mjs'].map((path) => covered(path))).toEqual([
		'counted',
		'counted',
		'counted'
	]);
	expect(['a.css', 'a.json', 'Cargo.toml', 'a.html'].map((path) => covered(path))).toEqual([
		'declarative',
		'declarative',
		'declarative',
		'declarative'
	]);
	expect(
		['a.rs', 'a.py', 'a.sh', 'a.sql', 'a.go', 'a.unknown', 'Makefile'].map((path) => covered(path))
	).toEqual(Array.from({ length: 7 }, () => 'unsupported'));
	expect(covered('page.html', true)).toBe('unsupported');
});

test('a unit is measured as far as its files are read and counted, and says where that ends', async () => {
	const [, counted] = await complexity('function.pick', ['src/utils/pick.ts']);
	expect([counted.value, counted.unavailable, counted.partial]).toEqual([2, undefined, undefined]);
	const [, zero] = await complexity('function.constants', ['src/utils/constants.ts']);
	expect([zero.value, zero.unavailable, zero.partial]).toEqual([0, undefined, undefined]);

	const crate = ['crates/counter/src/lib.rs', 'crates/counter/Cargo.toml'];
	const [bytes, rust] = await complexity('kernel.counter', crate);
	expect(bytes.value).toBe(
		Buffer.byteLength(sources[crate[0]]) + Buffer.byteLength(sources[crate[1]])
	);
	expect([rust.value, rust.partial]).toEqual([null, undefined]);
	expect(rust.unavailable).toBe(
		'Decision points are not counted in Rust: crates/counter/src/lib.rs.'
	);
	const [, mixed] = await complexity('kernel.counter', [...crate, 'crates/counter/bindings.ts']);
	expect([mixed.value, mixed.unavailable]).toEqual([3, undefined]);
	expect(mixed.partial).toBe(
		'Counted in 1 of 2 code files. Decision points are not counted in Rust: crates/counter/src/lib.rs.'
	);
	// A file that was not read has no size either: the sum is unknown, not smaller.
	const [unread] = await complexity('kernel.blob', ['crates/blob/data.bin', crate[1]]);
	expect([unread.value, unread.unavailable]).toEqual([
		null,
		'Not measured: crates/blob/data.bin was not read.'
	]);
});

const reason = 'Decision points are not counted in Rust: crates/counter/src/lib.rs.';
const row = (metric: string, value: number | null, extra: object = {}) => ({
	unit: 'kernel.counter',
	metric,
	value,
	workload: null,
	profile: null,
	...extra
});
const judged = (
	measured: ReturnType<typeof row>,
	baseline?: { metrics: Record<string, number>; unmeasured?: Record<string, string> }
) =>
	budgetFindings({
		unit: 'kernel.counter',
		profile: 'p1',
		defaultTarget: 'module',
		budgets: [],
		measurements: [row('source-bytes', 10), measured, row('dependencies', 1)],
		baseline: baseline ? { ...baseline, performance: [] } : undefined,
		checkSize: true
	}).find((finding) => finding.metric === 'complexity');

test('an unavailable frozen metric is stated only when its reviewed baseline says so too', () => {
	const none = row('complexity', null, { unavailable: reason });
	const sizes = { 'source-bytes': 10, dependencies: 1 };
	expect(judged(none)).toMatchObject({ status: 'missing-baseline', detail: reason });
	expect(judged(none, { metrics: sizes, unmeasured: { complexity: reason } })).toEqual({
		unit: 'kernel.counter',
		metric: 'complexity',
		baseline: null,
		measured: null,
		status: 'unavailable',
		detail: reason
	});
	// A number that existed at the baseline cannot quietly become unavailable.
	expect(judged(none, { metrics: { ...sizes, complexity: 7 } })).toMatchObject({
		status: 'missing-measurement',
		baseline: 7,
		detail: reason
	});
	// A value nobody explains is a measurement that was not taken, as before.
	expect(
		judged(row('complexity', null), { metrics: sizes, unmeasured: { complexity: reason } })?.status
	).toBe('missing-measurement');
	// Once it can be measured it needs a reviewed limit; the old statement does not cover it.
	expect(
		judged(row('complexity', 4), { metrics: sizes, unmeasured: { complexity: reason } })
	).toMatchObject({
		status: 'missing-baseline',
		measured: 4,
		detail: 'measurable-now'
	});
	const partial = 'Counted in 1 of 2 code files.';
	const within = judged(row('complexity', 3, { partial }), {
		metrics: { ...sizes, complexity: 3 }
	});
	const beyond = judged(row('complexity', 4, { partial }), {
		metrics: { ...sizes, complexity: 3 }
	});
	expect([within?.status, within?.detail, beyond?.status]).toEqual(['passed', partial, 'exceeded']);
});

const signed = {
	unit: 'kernel.counter',
	record: { id: 'r1', commit, tree: commit },
	reviewer: 'Reviewer One',
	reason: 'Reviewed.',
	at: '2026-10-10T00:00:00.000Z',
	performance: []
};

test('the ledger keeps a metric as a number or as a statement, and the gate words each case', () => {
	const service = new BudgetService();
	const stated: BudgetEvent = {
		type: 'baseline',
		...signed,
		metrics: { 'source-bytes': 10, dependencies: 1 },
		unmeasured: { complexity: reason }
	};
	const counted: BudgetEvent = {
		type: 'approval',
		...signed,
		before: { 'source-bytes': 10, dependencies: 1 },
		after: { 'source-bytes': 10, dependencies: 1, complexity: 4 }
	};
	expect(service.baselines([stated], []).get('kernel.counter')).toMatchObject({
		metrics: { 'source-bytes': 10, dependencies: 1 },
		unmeasured: { complexity: reason }
	});
	const later = service.baselines([stated, counted], []).get('kernel.counter');
	expect([later?.metrics.complexity, later?.unmeasured]).toEqual([4, undefined]);
	const back = service.baselines(
		[counted, { ...stated, type: 'approval', before: {}, after: {} }],
		[]
	);
	expect(back.get('kernel.counter')?.metrics.complexity).toBeUndefined();

	const manifest = unit('kernel.counter', []);
	const measurements = [row('source-bytes', 10), row('complexity', 4), row('dependencies', 1)];
	const subject = [
		{ manifest: { ...manifest, budgets: { performance: [] } } as never, checkSize: true }
	];
	const report = (baselines: ReturnType<BudgetService['baselines']>, rows = measurements) =>
		service.evaluate(subject, { measurements: rows as never, baselines, profile: 'p1' }).failures;
	expect(report(service.baselines([stated], []))).toEqual([
		'kernel.counter: complexity could not be measured when its limits were reviewed and is 4 now; a reviewer must approve a limit'
	]);
	const gone = [
		row('source-bytes', 10),
		row('complexity', null, { unavailable: reason }),
		row('dependencies', 1)
	];
	expect(report(service.baselines([stated, counted], []), gone)).toEqual([
		`kernel.counter: complexity was 4 at its baseline and can no longer be measured: ${reason}`
	]);
	expect(report(service.baselines([stated], []), gone)).toEqual([]);
});
