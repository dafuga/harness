import type { Side } from './sealRecord.types';
import type { ImpactReport } from '../../../../../core/development-tooling/impactTypes';
import type {
	Measurement,
	RecordedComponent
} from '../../../../../core/verification-evidence/verificationTypes';
import { benchmarkCaptureSchema } from '../../../../../core/verification-evidence/verifyTypes';
import { componentVersion } from '../../../../../utils/development-tooling/componentVersion';
import type { Gathered } from '../../../../../utils/verification-evidence/gatherCaptures';

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
