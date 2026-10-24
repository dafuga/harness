import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PerformanceProfileService } from '../../src/services/verification-evidence/PerformanceProfileService';
import { evidenceRequested } from '../../src/utils/reports-media/record-capture/recordCapture';
import {
	PerformanceEvidenceValidator,
	type PerformanceEvidenceInput
} from '../../src/validators/verification-evidence/PerformanceEvidenceValidator';
import { unmeasured } from '../../src/workflows/verification-evidence/run-verify/verification-service/record-assembly-service/unmeasured';
import { runCommand } from './cli';
import { measureProcess } from './cli-measurement/measureProcess';

/** Fake unit identifiers in profiler protocol tests never enter actual task evidence. */
export async function isolatedProfileCapture(check: (directory: string) => Promise<void>) {
	const directory = await mkdtemp(join(tmpdir(), 'harness-observation-'));
	const previous: Record<string, string | undefined> = {
		HARNESS_EVIDENCE_DIR: process.env.HARNESS_EVIDENCE_DIR,
		TAKE_SCREENSHOT: process.env.TAKE_SCREENSHOT
	};
	process.env.HARNESS_EVIDENCE_DIR = directory;
	process.env.TAKE_SCREENSHOT = '1';
	try {
		await check(directory);
	} finally {
		for (const name of ['HARNESS_EVIDENCE_DIR', 'TAKE_SCREENSHOT']) {
			if (previous[name] === undefined) delete process.env[name];
			else process.env[name] = previous[name];
		}
		await rm(directory, { recursive: true, force: true });
	}
}

export async function profileSingleCallObservation() {
	const profiler = new PerformanceProfileService();
	await taskProfile('service.performance-profile', 'observe-one-title-call', () =>
		profiler.observe({ unit: 'function.title', workload: 'title-text' }, () => ' TITLE '.trim())
	);
}

/** Actual operations over explicit fixture inputs; measurements are never fixture constants. */
export async function taskProfile(
	unit: string,
	workload: string,
	operation: () => unknown,
	iterations = 1
) {
	if (!evidenceRequested()) return;
	await new PerformanceProfileService().capture(
		{ unit, workload, iterations, rounds: 3, warmups: 1 },
		operation
	);
}

/** One real awaited test operation, retaining its result and effects without replay. */
export async function observedTaskOperation<T>(
	unit: string,
	workload: string,
	operation: () => T
): Promise<Awaited<T>> {
	if (!evidenceRequested()) return await operation();
	const profiler = new PerformanceProfileService();
	try {
		return await profiler.observeAsync({ unit, workload }, operation);
	} finally {
		profiler.flush();
	}
}

export async function profileEvidenceValidation(input: PerformanceEvidenceInput) {
	if (!evidenceRequested()) return;
	const units = Array.from({ length: 1000 }, (_, index) => ({
		...input.units[0],
		id: `function.title-${index}`
	}));
	const measurements = units.flatMap((unit) =>
		input.measurements.map((item) => ({ ...item, unit: unit.id }))
	);
	const validator = new PerformanceEvidenceValidator();
	await taskProfile('validator.performance-evidence', 'validate-1000-profiled-units', () =>
		validator.validate({ ...input, units, measurements })
	);
}

export async function profileMissingMeasurements() {
	const units = Array.from({ length: 1000 }, (_, index) => `function.unmeasured-${index}`);
	await taskProfile(
		'service.record-assembly-service-unmeasured',
		'missing-metrics-1000-units',
		() => units.map((unit) => unmeasured(unit, 'a'.repeat(40)))
	);
}

export async function profileProfiler() {
	const profiler = new PerformanceProfileService();
	const titles = Array.from({ length: 100 }, (_, index) => ` Item ${index} `);
	await taskProfile('service.performance-profile', 'measure-100-title-normalizations', () =>
		profiler.measure(
			{
				unit: 'service.performance-profile',
				workload: 'title-normalization-batch',
				iterations: 10,
				rounds: 1,
				warmups: 1
			},
			() => titles.map((title) => title.trim().toLowerCase())
		)
	);
}

/** A fresh public import, not a warm dependency observation borrowed by its barrel. */
export async function profilePublicEntry(unit: string, source: string, names: readonly string[]) {
	const program = `const api = await import(${JSON.stringify(source)});
const names = ${JSON.stringify(names)};
if (names.some(name => !(name in api))) throw new Error('Missing public export');
console.log(JSON.stringify(names));`;
	const result = await measureProcess(
		{
			units: [unit],
			workload: 'cold-bun-public-entry-import',
			target: 'module',
			command: ['bun', '--eval', program],
			cwd: process.cwd(),
			env: { HARNESS_RUNTIME_PROFILE_BOUNDARY: 'benchmark' }
		},
		runCommand
	);
	return JSON.parse(result.stdout) as string[];
}
