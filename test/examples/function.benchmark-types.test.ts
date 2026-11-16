import { test } from 'vitest';
import { z } from 'zod';
import {
	benchMeasurementSchema,
	calibrationNote,
	calibrationSchema,
	kernelBenchmarkSchema,
	representativeWorkload
} from '../../src/core/development-tooling/benchmarkTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * Each benchmark record schema is called the way a benchmark writer or reader parses a record. What
 * it was given and what it returned, or why it refused, is asserted and recorded as the cases of
 * its state. The schemas are pure: no folder, environment variable, process or network is involved.
 */

const commit = '9f1c2d3e4a5b6c7d8e9f0a1b2c3d4e5f60718293';
const profile = {
	id: 'linux-x64-8c',
	platform: 'linux',
	arch: 'x64',
	cpu: 'example 8-core',
	cores: 8,
	memoryBytes: 17179869184,
	runtime: 'bun 1.2'
};
const calibration = { kind: 'calibration', verified: false, note: calibrationNote };
const measurement = {
	unit: 'function.benchmark-types',
	callable: 'kernelBenchmarkSchema',
	metric: 'parse-ms',
	unitOfMeasure: 'ms',
	value: 0.42,
	method: 'median of five parses',
	workload: representativeWorkload,
	profile: profile.id,
	samples: 5,
	testedRevision: commit,
	artifacts: []
};
const workload = {
	id: representativeWorkload,
	nodes: 1000,
	edges: 4000,
	changed: 12,
	requestBytes: 2048,
	responseBytes: 512
};
const measuredDefault = {
	runtime: 'module',
	basis: 'measured',
	workload: representativeWorkload,
	profile: profile.id,
	rule: 'fastest cold start among candidates that pass parity',
	candidates: [{ runtime: 'module', coldMs: 12.5 }],
	excluded: [{ runtime: 'wasm', reason: 'no parity fixture yet' }]
};
const clean = {
	schemaVersion: 1,
	contract: 'impact-kernel',
	recordedAt: '2026-11-15T09:30:00.000Z',
	profile,
	source: { commit, dirty: false },
	provenance: calibration,
	workloads: [workload],
	measurements: [measurement],
	default: measuredDefault
};
const dirty = {
	...clean,
	source: { commit, dirty: true },
	workloads: [workload, { ...workload, id: 'graph-10k', nodes: 10000 }],
	measurements: [],
	default: { ...measuredDefault, basis: 'unmeasured', candidates: [], excluded: [] }
};

type Parser = { parse(value: unknown): unknown };
type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

/** Parses each input as a caller does; a refusal is kept as the reasons the schema gives. */
function parsing(schema: Parser) {
	return (name: string, input: unknown): ExampleCase => {
		try {
			return { name, input, output: schema.parse(input) };
		} catch (error) {
			return { name, input, error: reasons(error) };
		}
	};
}

/** The path and message of each refusal, in the order zod gives them; the root is named record. */
function reasons(error: unknown): string[] {
	if (!(error instanceof z.ZodError)) throw error;
	return error.issues.map((issue) => {
		const where = issue.path.length > 0 ? issue.path.join('.') : 'record';
		return `${where}: ${issue.message}`;
	});
}

/** A copy of the record without one field, for a record that leaves that field out. */
function without(record: Record<string, unknown>, key: string): Record<string, unknown> {
	return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

test('calibrationSchema parsed the exported note and another nonempty note', () => {
	const parse = parsing(calibrationSchema);
	const exported = parse('the exported calibration note', calibration);
	const other = parse('another nonempty note', { ...calibration, note: 'Local run on a laptop.' });
	expect(exported.output).toEqual(calibration);
	expect(other.output).toEqual({ ...calibration, note: 'Local run on a laptop.' });
	recordExampleCases(
		{
			unitId: 'function.benchmark-types',
			symbol: 'calibrationSchema',
			state: 'calibrationschema-parsed-the-exported-note-and-another-nonem',
			evidence: 'examples-cases',
			file: 'calibrationschema-parsed-the-exported-note-and-another-nonem.json'
		},
		[exported, other]
	);
});

test('calibrationSchema refused a record marked verified, another kind, an extra field and an empty note', () => {
	const parse = parsing(calibrationSchema);
	const verified = parse('verified set to true', { ...calibration, verified: true });
	const kind = parse('a kind other than calibration', { ...calibration, kind: 'verification' });
	const extra = parse('an extra field named hostname', { ...calibration, hostname: 'build-02' });
	const empty = parse('an empty note', { ...calibration, note: '' });
	expect(verified.error).toEqual([expect.stringContaining('verified')]);
	expect(kind.error).toEqual([expect.stringContaining('kind')]);
	expect(extra.error).toEqual([expect.stringContaining('hostname')]);
	expect(empty.error).toEqual([expect.stringContaining('note')]);
	recordExampleCases(
		{
			unitId: 'function.benchmark-types',
			symbol: 'calibrationSchema',
			state: 'calibrationschema-refused-a-record-marked-verified-another-k',
			evidence: 'examples-cases',
			file: 'calibrationschema-refused-a-record-marked-verified-another-k.json'
		},
		[verified, kind, extra, empty]
	);
});

test('benchMeasurementSchema parsed a full and a null commit id, and refused an uppercase or a missing commit id', () => {
	const parse = parsing(benchMeasurementSchema);
	const revision = parse('a full lowercase commit id', measurement);
	const uncommitted = parse('a null commit id, from uncommitted changes', {
		...measurement,
		testedRevision: null
	});
	const uppercase = parse('an uppercase commit id', {
		...measurement,
		testedRevision: commit.toUpperCase()
	});
	const missing = parse('no testedRevision field', without(measurement, 'testedRevision'));
	expect(revision.output).toEqual(measurement);
	expect(uncommitted.output).toEqual({ ...measurement, testedRevision: null });
	expect(uppercase.error).toEqual([expect.stringContaining('testedRevision')]);
	expect(missing.error).toEqual([expect.stringContaining('testedRevision')]);
	recordExampleCases(
		{
			unitId: 'function.benchmark-types',
			symbol: 'benchMeasurementSchema',
			state: 'benchmeasurementschema-parsed-a-full-and-a-null-commit-id-an',
			evidence: 'examples-cases',
			file: 'benchmeasurementschema-parsed-a-full-and-a-null-commit-id-an.json'
		},
		[revision, uncommitted, uppercase, missing]
	);
});

test('kernelBenchmarkSchema parsed a clean record, a dirty record and a record with an unknown key, and refused an empty workload id', () => {
	const parse = parsing(kernelBenchmarkSchema);
	const measured = parse('a clean record with a measured default', clean);
	const uncommitted = parse('a dirty record, unmeasured default, second workload id', dirty);
	const stripped = parse('a top-level field named hostname', { ...clean, hostname: 'build-02' });
	const emptyId = parse('a workload with an empty id', {
		...clean,
		workloads: [{ ...workload, id: '' }]
	});
	expect(measured.output).toEqual(clean);
	expect(uncommitted.output).toEqual(dirty);
	expect(stripped.output).toEqual(clean);
	expect(stripped.output).not.toHaveProperty('hostname');
	expect(emptyId.error).toEqual([expect.stringContaining('workloads.0.id')]);
	recordExampleCases(
		{
			unitId: 'function.benchmark-types',
			symbol: 'kernelBenchmarkSchema',
			state: 'kernelbenchmarkschema-parsed-a-clean-record-a-dirty-record-a',
			evidence: 'examples-cases',
			file: 'kernelbenchmarkschema-parsed-a-clean-record-a-dirty-record-a.json'
		},
		[measured, uncommitted, stripped, emptyId]
	);
});

test('kernelBenchmarkSchema refused schemaVersion 2, an unknown runtime, an extra source field and a profile with no memoryBytes', () => {
	const parse = parsing(kernelBenchmarkSchema);
	const version = parse('schemaVersion set to 2', { ...clean, schemaVersion: 2 });
	const runtime = parse('a default runtime named gpu', {
		...clean,
		default: { ...measuredDefault, runtime: 'gpu' }
	});
	const source = parse('an extra source field named branch', {
		...clean,
		source: { ...clean.source, branch: 'main' }
	});
	const noMemory = parse('a profile with no memoryBytes', {
		...clean,
		profile: without(profile, 'memoryBytes')
	});
	expect(version.error).toEqual([expect.stringContaining('schemaVersion')]);
	expect(runtime.error).toEqual([expect.stringContaining('default.runtime')]);
	expect(source.error).toEqual([expect.stringContaining('branch')]);
	expect(noMemory.error).toEqual([expect.stringContaining('profile.memoryBytes')]);
	recordExampleCases(
		{
			unitId: 'function.benchmark-types',
			symbol: 'kernelBenchmarkSchema',
			state: 'kernelbenchmarkschema-refused-schemaversion-2-an-unknown-run',
			evidence: 'examples-cases',
			file: 'kernelbenchmarkschema-refused-schemaversion-2-an-unknown-run.json'
		},
		[version, runtime, source, noMemory]
	);
});
