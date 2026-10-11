import type { SourceFile } from '../core/sourceTypes';
import type { ComponentManifest } from '../core/unitTypes';
import type { Measurement } from '../core/verificationTypes';
import { uncountedLanguage } from './complexityCoverage';

/** Size and hash of each declared artifact that exists, by path. */
export type BuiltArtifacts = Record<string, { bytes: number; sha256: string }>;

interface Static {
	metric: string;
	unitOfMeasure: string;
	value: number | null;
	method: string;
	/** Why there is no value at all. */
	unavailable?: string;
	/** What a value leaves out, when only part of the unit could be measured. */
	partial?: string;
}

const complexityMethod = 'Decision points in owned source, plus one per function or method.';

/** Size, complexity and dependency counts of one unit, read from its owned source. */
export function unitMeasurements(
	unit: ComponentManifest,
	files: ReadonlyMap<string, SourceFile>,
	testedRevision: string,
	artifacts: BuiltArtifacts = {}
): Measurement[] {
	const owned = unit.owns.source.flatMap((path) => files.get(path) ?? []);
	const metrics: Static[] = [
		sized(owned, 'source-bytes', 'bytes', (file) => file.bytes),
		sized(owned, 'source-lines', 'lines', (file) => file.lines),
		complexity(owned),
		dependencies(unit, owned)
	];
	const shared = { unit: unit.id, workload: null, profile: null, testedRevision };
	return [
		...metrics.map((metric) => ({ ...shared, ...metric, artifacts: [] })),
		...artifactMeasurements(unit, artifacts).map((entry) => ({ ...shared, ...entry }))
	];
}

/** A size is a sum over files that were read; one that was not leaves the sum unknown. */
function sized(
	owned: SourceFile[],
	metric: string,
	unitOfMeasure: string,
	pick: (file: SourceFile) => number
): Static {
	const method = `Sum of the ${unitOfMeasure === 'bytes' ? 'byte sizes' : 'line counts'} of the owned source files.`;
	const unread = owned.filter((file) => !file.read).map((file) => file.path);
	if (unread.length === 0) {
		return {
			metric,
			unitOfMeasure,
			value: owned.reduce((sum, file) => sum + pick(file), 0),
			method
		};
	}
	const unavailable = `Not measured: ${listed(unread)} ${unread.length === 1 ? 'was' : 'were'} not read.`;
	return { metric, unitOfMeasure, value: null, unavailable, method };
}

/**
 * Decision points are counted only where the language is read. A unit with code that is not
 * counted has no complete number: none at all when nothing in it is counted, and otherwise the
 * points of its counted files with a statement of what they leave out. Zero is only ever a count.
 */
function complexity(owned: SourceFile[]): Static {
	const base = { metric: 'complexity', unitOfMeasure: 'points', method: complexityMethod };
	const points = (file: SourceFile) =>
		file.blocks.reduce((sum, block) => sum + block.complexity, 0);
	const counted = owned.filter((file) => file.decisions === 'counted');
	const skipped = owned.filter((file) => file.decisions === 'unsupported');
	const value = counted.reduce((sum, file) => sum + points(file), 0);
	if (skipped.length === 0) return { ...base, value };
	const languages = [...new Set(skipped.map((file) => uncountedLanguage(file.path)))].sort();
	const left = `Decision points are not counted in ${languages.join(', ')}: ${listed(skipped.map((file) => file.path))}.`;
	if (counted.length === 0) return { ...base, value: null, unavailable: left };
	return {
		...base,
		value,
		partial: `Counted in ${counted.length} of ${counted.length + skipped.length} code files. ${left}`
	};
}

const dependencyManifests = new Set([
	'Cargo.toml',
	'pyproject.toml',
	'requirements.txt',
	'go.mod',
	'Gemfile'
]);

/**
 * Dependencies are the units a unit depends on plus the distinct outside modules its files
 * refer to, as far as references are read: in TypeScript, JavaScript, Svelte and stylesheets.
 * Code in another language, packages a manifest such as Cargo.toml declares, and references
 * that could not be resolved are not in the number, and the number says so. When nothing of the
 * unit is read and nothing is known, there is no number at all.
 */
function dependencies(unit: ComponentManifest, owned: SourceFile[]): Static {
	const base = {
		metric: 'dependencies',
		unitOfMeasure: 'count',
		method: 'Unit dependencies plus distinct external modules referenced.'
	};
	const external = new Set(
		owned.flatMap((file) => file.references.flatMap((reference) => reference.external ?? []))
	);
	const value = unit.dependencies.length + external.size;
	const left = unreadReferences(owned).join(' ');
	if (!left) return { ...base, value };
	const read = owned.some((file) => file.language !== 'other');
	return read || value > 0
		? { ...base, value, partial: left }
		: { ...base, value: null, unavailable: left };
}

/** What a count of dependencies could not include, one sentence for each kind of gap. */
function unreadReferences(owned: SourceFile[]): string[] {
	const paths = (files: SourceFile[]) => listed(files.map((file) => file.path));
	const code = owned.filter((file) => file.decisions === 'unsupported');
	const manifests = owned.filter((file) =>
		dependencyManifests.has(file.path.slice(file.path.lastIndexOf('/') + 1))
	);
	const unresolved = owned.filter((file) => file.references.some((item) => item.uncertain));
	const open = unresolved.flatMap((file) => file.references.filter((item) => item.uncertain));
	const languages = [...new Set(code.map((file) => uncountedLanguage(file.path)))].sort();
	return [
		...(code.length > 0
			? [`References are not read in ${languages.join(', ')}: ${paths(code)}.`]
			: []),
		...(manifests.length > 0 ? [`Packages declared in ${paths(manifests)} are not counted.`] : []),
		...(open.length > 0
			? [
					`${open.length} ${open.length === 1 ? 'reference' : 'references'} could not be resolved in ${paths(unresolved)}.`
				]
			: [])
	];
}

function listed(paths: string[]): string {
	const shown = paths.slice(0, 5).join(', ');
	return paths.length > 5 ? `${shown} and ${paths.length - 5} more` : shown;
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
