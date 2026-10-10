import type { VerificationRecord } from '../core/verificationTypes';

export interface LineageSource {
	/** The stored record with this id, if there is one. */
	find(id: string): VerificationRecord | undefined;
	/** What is wrong with a record on its own: identity, seal and evidence. */
	problems(record: VerificationRecord): string[];
}

const short = (id: string): string => id.slice(0, 12);

/**
 * Validates everything a record inherits: the base record it was judged against and the record
 * behind each referenced scenario, each followed to its own root. A dependency that is absent,
 * unsound, failed or part of a cycle makes the record unproven.
 */
export function recordLineage(
	record: VerificationRecord,
	source: LineageSource,
	path: string[] = []
): string[] {
	if (path.includes(record.id)) return ['inherited records form a cycle'];
	const next = [...path, record.id];
	const sound = (dependency: VerificationRecord): string | undefined =>
		[...source.problems(dependency), ...recordLineage(dependency, source, next)][0];
	return [...baseProblems(record, source, sound), ...scenarioProblems(record, source, sound)];
}

type Soundness = (dependency: VerificationRecord) => string | undefined;

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
	return record.scenarios.flatMap((scenario) => {
		if (scenario.status !== 'referenced' || !scenario.referencedRecord) return [];
		const subject = `scenario ${scenario.id} is inherited from record ${short(scenario.referencedRecord)}, which`;
		const found = source.find(scenario.referencedRecord);
		if (!found) return [`${subject} is not available`];
		const tested = found.scenarios.find((item) => item.id === scenario.id);
		const same =
			tested?.status === 'passed' &&
			tested.testedRevision === scenario.testedRevision &&
			found.source.commit === scenario.testedRevision;
		if (!same) return [`${subject} did not test it`];
		const problem = sound(found);
		return problem ? [`${subject} is not sound: ${problem}`] : [];
	});
}
