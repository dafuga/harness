import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { PerformanceEvidenceValidator } from '../../src/validators/verification-evidence/PerformanceEvidenceValidator';
import type { PerformanceEvidenceInput } from '../../src/validators/verification-evidence/PerformanceEvidenceValidator.types';

const validator = new PerformanceEvidenceValidator();

function manifest(id: string, status = 'active') {
	return {
		id,
		status,
		runtime: { kind: 'module', targets: [{ kind: 'module' }] },
		owns: { source: [`src/${id}.ts`] },
		helperContracts: []
	};
}

function source(path: string, execution: 'runtime' | 'declarative' = 'runtime') {
	return { path, language: 'typescript', read: true, execution };
}

test('Selects active units that need profiling', () => {
	const units = [manifest('runtime-unit'), manifest('declarative-unit'), manifest('inactive-unit', 'retired')];
	const files = new Map([
		['src/runtime-unit.ts', source('src/runtime-unit.ts')],
		['src/declarative-unit.ts', source('src/declarative-unit.ts', 'declarative')],
		['src/inactive-unit.ts', source('src/inactive-unit.ts')]
	]);
	const output = validator.required(units as never, files as never).map((unit) => unit.id);
	expect(output).toEqual(['runtime-unit']);
	recordExampleCases(
		{
			unitId: 'validator.performance-evidence',
			symbol: 'required',
			state: 'selects-active-units-that-need-profiling',
			evidence: 'examples-cases',
			file: 'selects-active-units-that-need-profiling.json'
		},
		[
			{
				name: 'Keeps active runtime code and excludes declarative and inactive units',
				input: { units: units.map(({ id, status }) => ({ id, status })), inspectedFiles: 3 },
				output
			}
		]
	);
});

function measurement(metric: string, value: number) {
	return {
		unit: 'reports.component.evidence-grid',
		callable: 'renderGrid',
		metric,
		value,
		unitOfMeasure: metric === 'latency-render-ms' ? 'ms' : 'bytes',
		workload: 'representative render',
		method: 'benchmark harness',
		comparison: { boundary: 'unit' },
		samples: 3,
		testedRevision: 'commit-1',
		profile: 'desktop',
		target: 'module'
	};
}

test('Requires matching latency and memory for each runtime target', () => {
	const unit = {
		...manifest('reports.component.evidence-grid'),
		id: 'reports.component.evidence-grid',
		helperContracts: [{ name: 'renderGrid' }],
		runtime: { kind: 'module', targets: [{ kind: 'module' }] }
	};
	const base = {
		units: [unit],
		files: new Map([['src/reports.component.evidence-grid.ts', source('src/reports.component.evidence-grid.ts')]]),
		commit: 'commit-1',
		profile: 'desktop'
	};
	const missingInput = { ...base, measurements: [] } as unknown as PerformanceEvidenceInput;
	const missing = validator.validate(missingInput);
	expect(missing).toEqual([
		'reports.component.evidence-grid#renderGrid (module): profiling requires current latency and memory observations for the same representative workload; run its Harness profile check.'
	]);
	const coveredInput = {
		...base,
		measurements: [measurement('latency-render-ms', 12), measurement('memory-bytes', 4096)]
	} as unknown as PerformanceEvidenceInput;
	const covered = validator.validate(coveredInput);
	expect(covered).toEqual([]);
	recordExampleCases(
		{
			unitId: 'validator.performance-evidence',
			symbol: 'validate',
			state: 'requires-matching-latency-and-memory-for-each-runtime-target',
			evidence: 'examples-cases',
			file: 'requires-matching-latency-and-memory-for-each-runtime-target.json'
		},
		[
			{ name: 'Reports uncovered callable', input: { measurementCount: 0 }, output: missing },
			{ name: 'Accepts paired observations for one workload', input: { metrics: ['latency-render-ms', 'memory-bytes'] }, output: covered }
		]
	);
});
