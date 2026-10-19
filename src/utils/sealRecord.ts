import { createHash } from 'node:crypto';
import type { ImpactReport } from '../core/impactTypes';
import type { SourceFile } from '../core/sourceTypes';
import type { ComponentManifest } from '../core/unitTypes';
import type {
	Measurement,
	RecordedComponent,
	ScenarioResult,
	VerificationRecord
} from '../core/verificationTypes';
import { benchmarkCaptureSchema } from '../core/verifyTypes';
import { canonicalJson } from './canonicalJson';
import { componentVersion } from './componentVersion';
import type { Gathered } from './gatherCaptures';

interface Side {
	manifests: ComponentManifest[];
	index: { files: Map<string, SourceFile> };
}

/** The exact version of every unit a verification tested or measured. */
export function recordComponents(
	impact: ImpactReport,
	sides: { base: Side; head: Side },
	measured: string[]
): RecordedComponent[] {
	const { units } = impact;
	const version = (id: string, side: Side, change: RecordedComponent['change']) => {
		const manifest = side.manifests.find((unit) => unit.id === id);
		if (!manifest) return [];
		const { unit, files, ...hashes } = componentVersion(manifest, side.index.files);
		return [{ unit, change, target: manifest.runtime.kind, ...hashes, files }];
	};
	const tested = [...new Set([...units.direct, ...units.indirect, ...measured])].sort();
	return tested.flatMap((id) => {
		if (units.removed.includes(id)) return version(id, sides.base, 'removed');
		return version(id, sides.head, changeOf(units, id));
	});
}

function changeOf(units: ImpactReport['units'], id: string): RecordedComponent['change'] {
	if (units.added.includes(id)) return 'added';
	return units.direct.includes(id) ? 'modified' : 'unchanged';
}

/**
 * Measurements a benchmark check reported, attributed to this run's profile and revision. A
 * capture that is not a valid benchmark contributes nothing; scenario coverage reports it.
 */
export function benchmarkMeasurements(
	gathered: Gathered[],
	context: { profile: string; commit: string }
): Measurement[] {
	return gathered.flatMap((item) => {
		const parsed = benchmarkCaptureSchema.safeParse(item.benchmark);
		const reported = parsed.success ? parsed.data.measurements : [];
		return reported.map((entry) => ({
			...entry,
			profile: context.profile,
			testedRevision: context.commit,
			artifacts: []
		}));
	});
}

/** An unaffected scenario keeps the evidence of the revision that last tested it. */
export function referencedScenario(
	prior: VerificationRecord,
	id: string
): ScenarioResult | undefined {
	const found = prior.scenarios.find((scenario) => scenario.id === id);
	if (!found || found.status === 'failed') return undefined;
	return { ...found, status: 'referenced', referencedRecord: found.referencedRecord ?? prior.id };
}

/** Seals a record: its id is the hash of everything else in it. */
export function sealRecord(draft: Omit<VerificationRecord, 'id'>): VerificationRecord {
	// Key order is not part of a record's meaning, so it is not part of its identity either.
	const id = createHash('sha256').update(canonicalJson(draft)).digest('hex');
	return { id, ...draft };
}

export function recordIntact(record: VerificationRecord): boolean {
	const { id, ...draft } = record;
	return sealRecord(draft).id === id;
}
