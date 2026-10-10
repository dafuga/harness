import type { SourceFile } from '../core/sourceTypes';
import type { ComponentManifest } from '../core/unitTypes';
import type { Measurement } from '../core/verificationTypes';

/** Size and hash of each declared artifact that exists, by path. */
export type BuiltArtifacts = Record<string, { bytes: number; sha256: string }>;

interface Static {
	metric: string;
	unitOfMeasure: string;
	value: number;
	method: string;
}

/** Size, complexity and dependency counts of one unit, read from its owned source. */
export function unitMeasurements(
	unit: ComponentManifest,
	files: ReadonlyMap<string, SourceFile>,
	testedRevision: string,
	artifacts: BuiltArtifacts = {}
): Measurement[] {
	const owned = unit.owns.source.flatMap((path) => files.get(path) ?? []);
	const total = (pick: (file: SourceFile) => number) =>
		owned.reduce((sum, file) => sum + pick(file), 0);
	const external = new Set(
		owned.flatMap((file) => file.references.flatMap((reference) => reference.external ?? []))
	);
	const complexity = (file: SourceFile) =>
		file.blocks.reduce((sum, block) => sum + block.complexity, 0);
	const metrics: Static[] = [
		measure(
			'source-bytes',
			'bytes',
			total((file) => file.bytes),
			'Sum of the byte sizes of the owned source files.'
		),
		measure(
			'source-lines',
			'lines',
			total((file) => file.lines),
			'Sum of the line counts of the owned source files.'
		),
		measure(
			'complexity',
			'points',
			total(complexity),
			'Decision points in owned source, plus one per function or method.'
		),
		measure(
			'dependencies',
			'count',
			unit.dependencies.length + external.size,
			'Unit dependencies plus distinct external modules referenced.'
		)
	];
	const shared = { unit: unit.id, workload: null, profile: null, testedRevision };
	return [
		...metrics.map((metric) => ({ ...shared, ...metric, artifacts: [] })),
		...artifactMeasurements(unit, artifacts).map((entry) => ({ ...shared, ...entry }))
	];
}

type ArtifactEntry = Pick<
	Measurement,
	'metric' | 'unitOfMeasure' | 'value' | 'unavailable' | 'method' | 'target' | 'artifacts'
>;

/** One entry per built target; a unit with nothing to build says so. */
function artifactMeasurements(unit: ComponentManifest, built: BuiltArtifacts): ArtifactEntry[] {
	const base = { metric: 'artifact-bytes', unitOfMeasure: 'bytes' };
	const emitted = unit.runtime.targets.filter(
		(target) => target.kind === 'wasm' || target.kind === 'process'
	);
	if (emitted.length === 0) {
		const unavailable = 'A module unit emits no separate artifact.';
		return [{ ...base, value: null, unavailable, method: 'Not applicable.', artifacts: [] }];
	}
	return emitted.map((target): ArtifactEntry => {
		const found = built[target.entry];
		const method = 'Byte size of the artifact as built in the verified snapshot.';
		if (!found) {
			const unavailable = `${target.entry} was not built in the verified snapshot.`;
			return { ...base, value: null, unavailable, method, target: target.kind, artifacts: [] };
		}
		const artifacts = [{ path: target.entry, ...found }];
		return { ...base, value: found.bytes, method, target: target.kind, artifacts };
	});
}

function measure(metric: string, unitOfMeasure: string, value: number, method: string): Static {
	return { metric, unitOfMeasure, value, method };
}
