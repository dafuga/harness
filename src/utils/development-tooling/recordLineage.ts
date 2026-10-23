import type { LineageSource, Soundness } from './recordLineage.types';
import type { VerificationRecord } from '../../core/verification-evidence/verificationTypes';
import { canonicalJson } from './canonicalJson';

const short = (id: string): string => id.slice(0, 12);

/** Checks base and scenario ancestry, refusing missing, damaged, failed or cyclic records. */
export function recordLineage(
	record: VerificationRecord,
	source: LineageSource,
	path: string[] = []
): string[] {
	// Cache per call and stored object: equal ids alone never share results.
	const checked = new WeakMap<VerificationRecord, string | undefined>();
	const visit = (current: VerificationRecord, trail: string[]): string[] => {
		if (trail.includes(current.id)) return ['inherited records form a cycle'];
		const next = [...trail, current.id];
		const sound = (dependency: VerificationRecord): string | undefined => {
			if (!checked.has(dependency)) {
				checked.set(dependency, [...source.problems(dependency), ...visit(dependency, next)][0]);
			}
			return checked.get(dependency);
		};
		return [...baseProblems(current, source, sound), ...scenarioProblems(current, source, sound)];
	};
	return visit(record, path);
}

function baseProblems(
	record: VerificationRecord,
	source: LineageSource,
	sound: Soundness
): string[] {
	const { base, baseRecord } = record.source;
	if (!base || !baseRecord) return [];
	const subject = `base record ${short(baseRecord)}`;
	const found = source.find(baseRecord);
	if (!found) return [`${subject} is not available`];
	if (found.source.commit !== base) {
		return [`${subject} is for commit ${found.source.commit}, not ${base}`];
	}
	if (found.status !== 'passed') return [`${subject} did not pass`];
	const problem = sound(found);
	return problem ? [`${subject} is not sound: ${problem}`] : [];
}

function scenarioProblems(
	record: VerificationRecord,
	source: LineageSource,
	sound: Soundness
): string[] {
	const referenced = record.scenarios.filter((scenario) => scenario.status === 'referenced');
	return referenced.flatMap((scenario) => {
		if (!scenario.referencedRecord) return [];
		const subject = `scenario ${scenario.id} is inherited from record ${short(scenario.referencedRecord)}, which`;
		const found = source.find(scenario.referencedRecord);
		if (!found) return [`${subject} is not available`];
		const tested = found.scenarios.find((item) => item.id === scenario.id);
		if (
			tested?.status !== 'passed' ||
			tested.testedRevision !== scenario.testedRevision ||
			found.source.commit !== scenario.testedRevision
		)
			return [`${subject} did not test it`];
		if (canonicalJson(scenario.states) !== canonicalJson(tested.states))
			return [
				`scenario ${scenario.id} differs from the states and captures in its inherited record`
			];
		// A scenario that passed inside a record that failed is not proof: only a record that
		// passed as a whole is one a later record may inherit from.
		if (found.status !== 'passed') return [`${subject} did not pass`];
		const problem = sound(found);
		return problem ? [`${subject} is not sound: ${problem}`] : [];
	});
}

export type { LineageSource } from './recordLineage.types';
