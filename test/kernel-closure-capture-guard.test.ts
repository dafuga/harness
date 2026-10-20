import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, test } from 'vitest';
import { artifactCases } from '../packages/reports/src/components/entity-cases/artifactCases';
import type { ImpactInput, ImpactOutput } from '../src/core/kernelTypes';
import { componentManifestSchema, scenarioManifestSchema } from '../src/core/unitTypes';
import { captureIndex, captureLineSchema } from '../src/core/verifyTypes';
import { kernelClosure } from '../src/utils/impact-kernel/kernelClosure';
import { ownEnvironment } from './support/cli';
import { expect } from './verificationExpect';

/**
 * The calls of kernelClosure a function is shown with are recorded by its own producer test, as
 * ordinary JSON under its own unit. This runs that producer alone, as an ordinary opted-in run
 * writing into a directory of its own, and reads what it recorded the way the viewer does: no
 * capture, a capture of another unit, or an output kernelClosure does not return all fail here.
 */
const root = resolve(import.meta.dirname, '..');
const scenario = 'kernel-closure-cases';
const unit = 'function.kernel-closure';
const source = 'src/utils/kernelClosure.ts';
const producer = 'test/kernel-closure-capture.test.ts';
const guard = 'test/kernel-closure-capture-guard.test.ts';
const file = 'kernel-closure-cases.json';
/** The outer run's Vitest state and assertion run id, which the producer run must not share. */
const foreign = /^VITEST|^HARNESS_ASSERTION_RUN_ID$/;
type Call = { name: string; input: ImpactInput; output: ImpactOutput };
type Recorded = Record<string, unknown> & { cases: Call[] };
const owned: string[] = [];
afterEach(() => {
	for (const directory of owned.splice(0)) rmSync(directory, { recursive: true, force: true });
});
const read = (path: string) => readFileSync(join(root, path), 'utf8');
/** The SHA-256 of the exact bytes of a tracked file as it is now. */
function digest(path: string): string {
	const hash = createHash('sha256');
	return hash.update(readFileSync(join(root, path))).digest('hex');
}

/** This run's environment without any verification or Vitest context of its own, opted in. */
function producerEnvironment(evidence: string): Record<string, string | undefined> {
	const environment = ownEnvironment();
	for (const name of Object.keys(environment)) {
		if (foreign.test(name)) delete environment[name];
	}
	return {
		...environment,
		TAKE_SCREENSHOT: '1',
		HARNESS_EVIDENCE_DIR: evidence,
		HARNESS_SCENARIO: scenario
	};
}

/** Runs the producer test alone through the local Vitest CLI and reads the captures it indexed. */
function produce() {
	const evidence = mkdtempSync(join(tmpdir(), 'kernel-closure-cases-'));
	owned.push(evidence);
	const cli = join(root, 'node_modules/vitest/vitest.mjs');
	const run = spawnSync(process.execPath, [cli, 'run', producer], {
		cwd: root,
		env: producerEnvironment(evidence),
		encoding: 'utf8',
		timeout: 150_000,
		maxBuffer: 16_000_000
	});
	const index = join(evidence, captureIndex);
	const text = existsSync(index) ? readFileSync(index, 'utf8') : '';
	const lines = text
		.split('\n')
		.filter(Boolean)
		.map((line) => captureLineSchema.parse(JSON.parse(line)));
	return { run, evidence, lines };
}

/** Three or more distinct calls, each holding what kernelClosure returns for its input now. */
function checkCalls(cases: Call[]): void {
	const keys = cases.map((item) => Object.keys(item).sort().join(','));
	expect(keys).toEqual(cases.map(() => 'input,name,output'));
	expect(new Set(cases.map((item) => item.name)).size).toBe(cases.length);
	const inputs = new Set(cases.map((item) => JSON.stringify(item.input)));
	expect(inputs.size).toBeGreaterThanOrEqual(3);
	const fresh = cases.map((item) => kernelClosure(item.input));
	expect(cases.map((item) => item.output)).toEqual(fresh);
	const affected = cases.flatMap((item) => item.output.affected);
	const shown = {
		transitive: affected.some((node) => node.distance >= 2),
		removed: affected.some((node) => node.presence === 'removed'),
		uncertain: affected.some((node) => node.seed === 'uncertain'),
		uncovered: cases.some((item) => item.output.uncovered.length > 0),
		unknown: cases.some((item) => item.output.unknown.length > 0)
	};
	expect(shown).toEqual({
		transitive: true,
		removed: true,
		uncertain: true,
		uncovered: true,
		unknown: true
	});
}

test('kernel-closure-cases is a headless scenario of the unit that owns kernelClosure', () => {
	const path = `specification/scenarios/${scenario}.json`;
	expect(existsSync(join(root, path))).toBe(true);
	const manifest = scenarioManifestSchema.parse(JSON.parse(read(path)));
	expect(manifest).toMatchObject({ kind: 'headless', viewports: [] });
	expect(manifest.units).toContain(unit);
	expect(manifest.states).toContainEqual(
		expect.objectContaining({ id: 'ordinary-json', coverage: 'required' })
	);
	const tests = manifest.tests.map((item) => [item.runner, item.target]);
	expect(tests).toEqual(
		expect.arrayContaining([
			['vitest', producer],
			['vitest', guard]
		])
	);
	expect(manifest.evidence).toContainEqual(
		expect.objectContaining({
			id: 'calls',
			kind: 'assertions',
			states: expect.arrayContaining(['ordinary-json']),
			viewports: [],
			required: true
		})
	);
	const ownerPath = `specification/units/${unit}.json`;
	const owner = componentManifestSchema.parse(JSON.parse(read(ownerPath)));
	expect(owner.scenarios).toContain(scenario);
});

test('the producer alone records actual ordinary JSON kernelClosure calls of its own unit', () => {
	const { run, evidence, lines } = produce();
	expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
	const calls = lines.filter((line) => line.evidence === 'calls');
	expect(calls).toHaveLength(1);
	expect(calls[0]).toMatchObject({
		kind: 'assertions',
		state: 'ordinary-json',
		file,
		mediaType: 'application/json'
	});
	const document = JSON.parse(readFileSync(join(evidence, file), 'utf8')) as Recorded;
	expect(document).toMatchObject({
		schemaVersion: 1,
		kind: 'function-invocations',
		unitId: unit,
		symbol: 'kernelClosure',
		source: { path: source, sha256: digest(source) }
	});
	expect(Array.isArray(document.cases)).toBe(true);
	checkCalls(document.cases);
	expect(artifactCases(document, unit)).toEqual({
		kind: 'cases',
		source: 'invocations',
		symbol: 'kernelClosure',
		cases: document.cases.map((item) => ({ ...item, failed: false }))
	});
	expect(artifactCases(document, 'function.impact-kernel')).toEqual({
		kind: 'gap',
		why: `Its cases are of another unit, ${unit}.`
	});
}, 180_000);
