import type { SourceFile } from '../../core/development-tooling/sourceTypes';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type { Measurement } from '../../core/verification-evidence/verificationTypes';
import type { PerformanceEvidenceInput } from './PerformanceEvidenceValidator.types';
export type { PerformanceEvidenceInput } from './PerformanceEvidenceValidator.types';

/** Budgets control allowed growth; they never decide whether profiling must run. */
export class PerformanceEvidenceValidator {
	required(units: ComponentManifest[], files: Map<string, SourceFile>): ComponentManifest[] {
		return units.filter((unit) => executable(unit, files));
	}
	validate(input: PerformanceEvidenceInput): string[] {
		return this.required(input.units, input.files).flatMap((unit) => {
			const callables = unit.helperContracts?.map((helper) => helper.name) ?? [];
			return (callables.length ? callables : [undefined]).flatMap((callable) =>
				unit.runtime.targets.flatMap((target) =>
					requiredMetrics(input, { unit: unit.id, callable, target: target.kind })
				)
			);
		});
	}
}

function executable(unit: ComponentManifest, files: Map<string, SourceFile>): boolean {
	if (unit.status !== 'active') return false;
	if (unit.runtime.kind !== 'module') return true;
	const owned = unit.owns.source.map((path) => files.get(path));
	if (owned.some((file) => !file?.read)) return true;
	if (owned.length === 0) return true;
	const code = owned.filter((file) => file?.language !== 'css');
	return code.some((file) => file?.execution !== 'declarative');
}

function requiredMetrics(
	input: PerformanceEvidenceInput,
	subject: { unit: string; callable?: string; target: string }
): string[] {
	const own = input.measurements.filter(
		(item) =>
			item.unit === subject.unit &&
			item.callable === subject.callable &&
			(item.target ?? 'module') === subject.target &&
			item.testedRevision === input.commit &&
			item.profile === input.profile &&
			observed(item)
	);
	const latency = own.filter(
		(item) =>
			(item.metric.startsWith('latency-') || item.metric === 'browser-navigation-ms') &&
			item.unitOfMeasure === 'ms'
	);
	const memory = own.filter(
		(item) =>
			['memory-bytes', 'process-peak-rss-bytes', 'browser-js-heap-bytes'].includes(item.metric) &&
			item.unitOfMeasure === 'bytes' &&
			item.value! > 0
	);
	const paired = latency.some((time) => memory.some((size) => size.workload === time.workload));
	const label = `${subject.unit}${subject.callable ? `#${subject.callable}` : ''} (${subject.target})`;
	return paired
		? []
		: [
				`${label}: profiling requires current latency and memory observations for the same representative workload; run its Harness profile check.`
			];
}

function observed(item: Measurement): boolean {
	return (
		item.value !== null &&
		Number.isFinite(item.value) &&
		item.value >= 0 &&
		Boolean(item.workload?.trim()) &&
		Boolean(item.method.trim()) &&
		item.comparison?.boundary !== 'fixture' &&
		(item.samples ?? 0) > 0
	);
}
