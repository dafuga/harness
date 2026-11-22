import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	emittedTargets,
	unitMeasurements
} from '../../src/utils/development-tooling/unitMeasurements';
import type { BuiltArtifacts } from '../../src/utils/development-tooling/unitMeasurements';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import type { SourceFile } from '../../src/core/development-tooling/sourceTypes';
import type { SourceBlock } from '../../src/utils/development-tooling/sourceBlocks';

type Targets = ComponentManifest['runtime']['targets'];
type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

const revision = '0123456789abcdef0123456789abcdef01234567';
const sha = (character: string) => character.repeat(64);
const moduleOnly = [{ kind: 'module', entry: 'src/index.ts' }] as Targets;
const noArtifact = 'A module unit emits no separate artifact.';
const unread = 'Not measured: src/data.bin was not read.';
const zod = { via: 'import', typeOnly: false, external: 'zod' } as const;
const open = {
	via: 'import',
	typeOnly: false,
	uncertain: { reason: 'unresolved-import', detail: './gone' }
} as const;
const plain = { bytes: 100, lines: 10, language: 'ts', read: true, decisions: 'counted' } as const;

/** A unit manifest as the measurement reads it: owned source, dependencies and runtime targets. */
function unit(id: string, source: string[], targets: Targets, dependencies: string[] = []) {
	const deps = dependencies.map((target) => ({ unit: target, via: 'import', origin: 'derived' }));
	const manifest = { id, owns: { source, symbols: [] }, dependencies: deps, runtime: { targets } };
	return manifest as unknown as ComponentManifest;
}

/** A source file as the index reports it; the facts a case does not name are the ordinary ones. */
function file(path: string, patch: Partial<SourceFile> = {}): SourceFile {
	return { path, references: [], blocks: [], ...plain, ...patch } as SourceFile;
}

const block = (complexity: number) =>
	({ name: 'run', kind: 'function', complexity }) as SourceBlock;
const indexed = (files: SourceFile[]) =>
	new Map(files.map((item): [string, SourceFile] => [item.path, item]));
const unitId = 'function.unit-measurements';
const record = (symbol: string, state: string, cases: ExampleCase[]) =>
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);

test('unitMeasurements measures owned files, skips unowned ones and copies the revision', () => {
	const owned = [
		file('src/pick.ts', { bytes: 120, lines: 4, blocks: [block(2)], references: [zod] }),
		file('src/constants.ts', { bytes: 30, lines: 1 }),
		file('src/other.ts', { bytes: 999, lines: 40, blocks: [block(7)] })
	];
	const pick = unit('function.pick', ['src/pick.ts', 'src/constants.ts'], moduleOnly, [
		'function.types'
	]);
	const rows = unitMeasurements(pick, indexed(owned), revision);
	const copied = unitMeasurements(pick, indexed(owned), 'not-a-commit');

	expect(rows.map((row) => [row.metric, row.value])).toEqual([
		['source-bytes', 150],
		['source-lines', 5],
		['complexity', 2],
		['dependencies', 2],
		['artifact-bytes', null]
	]);
	expect(rows.map((row) => [row.unit, row.workload, row.profile, row.testedRevision])).toEqual(
		rows.map(() => ['function.pick', null, null, revision])
	);
	expect(rows.at(-1)?.unavailable).toBe(noArtifact);
	expect(copied.map((row) => row.testedRevision)).toEqual(copied.map(() => 'not-a-commit'));
	record('unitMeasurements', 'unitmeasurements-owned-files-and-revision', [
		{
			name: 'owned files counted, an unowned file ignored, one external import',
			input: { unit: pick, files: owned, testedRevision: revision },
			output: rows
		},
		{
			name: 'a revision that is not a commit hash is copied unchecked',
			input: { unit: pick, files: owned, testedRevision: 'not-a-commit' },
			output: copied
		}
	]);
});

test('unitMeasurements states what an unread file and unresolved references leave out', () => {
	const sources = ['src/a.ts', 'src/data.bin', 'src/missing.ts'];
	const mixed = unit('function.mixed', sources, moduleOnly);
	const listed = [
		file('src/a.ts', { bytes: 40, lines: 3, blocks: [block(3)], references: [open] }),
		file('src/data.bin', { read: false, language: 'other', decisions: 'unsupported' })
	];
	const rows = unitMeasurements(mixed, indexed(listed), revision);

	expect(rows.map((row) => [row.value, row.unavailable ?? row.partial])).toEqual([
		[null, unread],
		[null, unread],
		[
			3,
			'Counted in 1 of 2 code files. Decision points are not counted in .bin files: src/data.bin.'
		],
		[
			0,
			'References are not read in .bin files: src/data.bin. 1 reference could not be resolved in src/a.ts.'
		],
		[null, noArtifact]
	]);
	record('unitMeasurements', 'unitmeasurements-unread-and-unresolved-gaps', [
		{
			name: 'unread binary, a missing path and one unresolved import',
			input: { unit: mixed, files: listed, testedRevision: revision },
			output: rows
		}
	]);
});

test('unitMeasurements gives no number only where nothing can be counted', () => {
	const script = unit('function.script', ['scripts/tool.py'], moduleOnly);
	const scripted = [
		file('scripts/tool.py', { language: 'other', decisions: 'unsupported', bytes: 80 })
	];
	const styled = unit('function.styles', ['src/app.css'], moduleOnly);
	const stylesheet = [
		file('src/app.css', { language: 'css', decisions: 'declarative', bytes: 60 })
	];
	const scriptRows = unitMeasurements(script, indexed(scripted), revision);
	const styleRows = unitMeasurements(styled, indexed(stylesheet), revision);

	expect(scriptRows.slice(2, 4).map((row) => [row.metric, row.value, row.unavailable])).toEqual([
		['complexity', null, 'Decision points are not counted in Python: scripts/tool.py.'],
		['dependencies', null, 'References are not read in Python: scripts/tool.py.']
	]);
	expect(styleRows.slice(2, 4).map((row) => [row.metric, row.value])).toEqual([
		['complexity', 0],
		['dependencies', 0]
	]);
	expect(
		styleRows.slice(0, 4).filter((row) => (row.partial ?? row.unavailable) !== undefined)
	).toEqual([]);
	record('unitMeasurements', 'unitmeasurements-no-number-only-where-nothing-counted', [
		{
			name: 'python file only: complexity and dependencies have no number',
			input: { unit: script, files: scripted, testedRevision: revision },
			output: scriptRows
		},
		{
			name: 'stylesheet only: a zero count with no note',
			input: { unit: styled, files: stylesheet, testedRevision: revision },
			output: styleRows
		}
	]);
});

test('unitMeasurements keeps wasm and process sizes apart and states unbuilt targets', () => {
	const kernel = unit('kernel.impact', [], [
		{ kind: 'wasm', entry: 'target/kernel.wasm' },
		{ kind: 'module', entry: 'src/index.ts' },
		{ kind: 'process', entry: 'target/kernel' },
		{ kind: 'process', entry: 'target/kernel' },
		{ kind: 'process', entry: 'target/tools' }
	] as Targets);
	const built: BuiltArtifacts = {
		'target/kernel.wasm': { bytes: 143132, sha256: sha('2') },
		'target/kernel': { bytes: 402048, sha256: sha('1') }
	};
	const artifact = (row: { metric: string }) => row.metric === 'artifact-bytes';
	const sizes = unitMeasurements(kernel, new Map(), revision, built).filter(artifact);
	const unbuilt = unitMeasurements(kernel, new Map(), revision).filter(artifact);
	const web = unit('function.pick', [], [
		{ kind: 'module', entry: 'src/index.ts' },
		{ kind: 'http', entry: 'src/routes.ts' }
	] as Targets);
	const bare = unitMeasurements(web, new Map(), revision).filter(artifact);

	expect(sizes.map((row) => [row.target, row.value])).toEqual([
		['wasm', 143132],
		['process', null]
	]);
	expect(sizes[0]).toMatchObject({ artifacts: [{ path: 'target/kernel.wasm', bytes: 143132 }] });
	expect(sizes[1]).toMatchObject({
		unavailable: 'target/tools was not built in the verified snapshot.',
		artifacts: [{ path: 'target/kernel', bytes: 402048, sha256: sha('1') }]
	});
	expect(unbuilt.map((row) => [row.target, row.value, row.unavailable])).toEqual([
		['wasm', null, 'target/kernel.wasm was not built in the verified snapshot.'],
		['process', null, 'target/kernel, target/tools were not built in the verified snapshot.']
	]);
	expect(bare.map((row) => [row.value, row.unavailable, 'target' in row])).toEqual([
		[null, noArtifact, false]
	]);
	record('unitMeasurements', 'unitmeasurements-wasm-and-process-apart-unbuilt-stated', [
		{
			name: 'wasm built, process missing one of its distinct artifacts',
			input: { unit: kernel, files: [], testedRevision: revision, artifacts: built },
			output: sizes
		},
		{
			name: 'no artifacts supplied, so every target size is unavailable',
			input: { unit: kernel, files: [], testedRevision: revision },
			output: unbuilt
		},
		{
			name: 'module and http targets only give one artifact with no target',
			input: { unit: web, files: [], testedRevision: revision },
			output: bare
		}
	]);
});

test('emittedTargets returns only wasm and process targets, in order and unchanged', () => {
	const mixed = unit('kernel.impact', [], [
		{ kind: 'module', entry: 'src/index.ts' },
		{ kind: 'wasm', entry: 'target/kernel.wasm' },
		{ kind: 'http', entry: 'src/routes.ts' },
		{ kind: 'process', entry: 'target/kernel' }
	] as Targets);
	const kept = emittedTargets(mixed);
	const modules = emittedTargets(unit('function.pick', [], moduleOnly));

	expect(kept.map((target) => target.kind)).toEqual(['wasm', 'process']);
	expect(kept[0]).toBe(mixed.runtime.targets[1]);
	expect(kept[1]).toBe(mixed.runtime.targets[3]);
	expect(modules).toEqual([]);
	record('emittedTargets', 'emittedtargets-wasm-and-process-only-in-order', [
		{ name: 'module, wasm, http and process targets', input: { unit: mixed }, output: kept },
		{
			name: 'module-only unit gets an empty list',
			input: { unit: unit('function.pick', [], moduleOnly) },
			output: modules
		}
	]);
});
