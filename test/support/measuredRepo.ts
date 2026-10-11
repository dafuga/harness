import { baselineRepo, type VerifyRepo } from './verifyRepo';

export interface Measured {
	unit: string;
	metric: string;
	value: number | null;
	unavailable?: string;
	partial?: string;
}
export interface Finding {
	unit: string;
	metric: string;
	status: string;
	baseline: number | null;
	measured: number | null;
	detail?: string;
}
export interface LedgerLine {
	unit: string;
	metrics: Record<string, number>;
	unmeasured?: Record<string, string>;
}

export interface Growth {
	id: string;
	growth: Array<{ 'source-bytes'?: number; complexity?: number; notes?: Record<string, string> }>;
}

// Real control flow in languages whose decision points Harness does not count.
export const rust = [
	"pub fn classify(value: i32) -> &'static str {",
	'    if value < 0 {',
	'        return "negative";',
	'    }',
	'    match value {',
	'        0 => "zero",',
	'        1..=9 => "small",',
	'        _ => "large",',
	'    }',
	'}',
	''
].join('\n');
const python =
	"def label(value):\n    if value and value > 1:\n        return 'many'\n    return 'one'\n";
// One function, one `if` and one `&&`: three points.
const bindings =
	'export function bound(value: number): number {\n\tif (value > 1 && value < 9) return value;\n\treturn 0;\n}\n';
export const manifest =
	'[package]\nname = "counter"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nserde = "1"\n';
// Two modules from outside the repository and one unit of it: three dependencies, all read.
const reader =
	"import { readFileSync } from 'node:fs';\nimport { join } from 'node:path';\nimport { limit } from './constants';\n" +
	"export const reader = (name: string) => readFileSync(join('.', name), 'utf8').slice(0, limit);\n";
// A module only known when it runs: the count cannot include it.
const loader =
	'export function loader(name: string): Promise<unknown> {\n\treturn import(name);\n}\n';

/**
 * A verified fixture with baselines, holding units in languages Harness does not read beside
 * units it reads completely: a Rust crate, a crate with a TypeScript file, a Python script, a
 * module that refers to nothing, one that reads two outside modules and one unit, and one whose
 * import is only known when it runs.
 */
export function measuredRepo(): Promise<VerifyRepo> {
	return baselineRepo(async (repo) => {
		await repo.write('crates/counter/Cargo.toml', manifest);
		await repo.write('crates/counter/src/lib.rs', rust);
		await repo.write('crates/mixed/src/lib.rs', rust);
		await repo.write('crates/mixed/bindings.ts', `import { sep } from 'node:path';\n${bindings}`);
		await repo.write('src/utils/reader.ts', reader);
		await repo.write('src/utils/loader.ts', loader);
		await repo.write('scripts/report.py', python);
		// A unit with nothing to decide: its complexity really is zero.
		await repo.write('src/utils/constants.ts', 'export const limit = 10;\n');
		await repo.harness(['units', 'index', '--write']);
	});
}

/** The one row or finding a unit must have; a missing one is a failure of the test itself. */
export function only<Item>(items: Item[], wanted: (item: Item) => boolean, name: string): Item {
	const found = items.filter(wanted);
	if (found.length !== 1) throw new Error(`${found.length} entries for ${name}`);
	return found[0];
}
export const measuredOf = (rows: Measured[], unit: string, metric: string) =>
	only(rows, (row) => row.unit === unit && row.metric === metric, `${unit} ${metric}`);
export const complexityOf = (rows: Measured[], unit: string) =>
	measuredOf(rows, unit, 'complexity');
export const findingOf = (findings: Finding[], unit: string, metric = 'complexity') =>
	only(findings, (item) => item.unit === unit && item.metric === metric, `${unit} ${metric}`);

/** The lines of the budget ledger of a repository. */
export async function ledgerOf(repo: VerifyRepo): Promise<LedgerLine[]> {
	const text = await repo.read('specification/budgets/ledger.ndjson');
	return text
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line) as LedgerLine);
}

/** The growth point of the Rust unit in the index built after one record was attached. */
export async function indexedPoint(
	repo: VerifyRepo,
	record: string
): Promise<Growth['growth'][number]> {
	await repo.harness(['history', 'attach', '--record', record]);
	const out = ['history', 'build', '--out', '.cache/measured-index'];
	const built = await repo.harnessJson<{ index: { units: Growth[] } }>(out);
	return only(built.index.units, (item) => item.id === 'kernel.counter', 'growth').growth[0];
}
