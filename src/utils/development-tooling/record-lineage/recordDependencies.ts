// @harness-uid u_mqlnjtpu6l
import type { RecordLinks } from '../recordLineage.types';

export function clipParentRecords(record: RecordLinks): string[] {
	return [
		...new Set(
			record.scenarios
				.filter((scenario) => scenario.status !== 'referenced')
				.flatMap(
					(scenario) =>
						scenario.states?.flatMap(
							(state) =>
								state.captures?.flatMap((capture) => capture.videoReference?.record ?? []) ?? []
						) ?? []
				)
		)
	];
}

export function recordDependencies(record: RecordLinks): string[] {
	return [...new Set([...wholeRecordDependencies(record), ...clipParentRecords(record)])];
}

/** Only these dependencies inherit a complete verification verdict. */
export function wholeRecordDependencies(record: RecordLinks): string[] {
	return [
		...new Set([
			record.source.baseRecord ?? '',
			...record.scenarios.flatMap((scenario) => scenario.referencedRecord ?? [])
		])
	].filter(Boolean);
}
