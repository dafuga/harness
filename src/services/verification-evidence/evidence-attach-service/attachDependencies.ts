// @harness-uid u_q33nfdq3id
const scopedPrefix = 'Scoped to ';
import type { DependentRecord } from './attachDependencies.types';
import { clipParentRecords } from '../../../utils/development-tooling/record-lineage/recordDependencies';

/** A scoped (--entity) record proves only its own entity; it inherits and cites no other record. */
export function isScopedRecord(record: Pick<DependentRecord, 'failures'>): boolean {
	return record.failures.some((failure) => failure.startsWith(scopedPrefix));
}

/** Records a record inherits from: its base and the records behind inherited scenarios. */
export function inheritedRecords(record: DependentRecord): string[] {
	const clips = clipParentRecords(record);
	if (isScopedRecord(record)) return clips;
	const inherited = record.scenarios.flatMap((scenario) => scenario.referencedRecord ?? []);
	return [...new Set([record.source.baseRecord ?? '', ...inherited, ...clips])].filter(Boolean);
}

/** Records the commit's budget ledger cites, which a full record attaches first. */
export function citedRecords(record: DependentRecord, ledger: string[]): string[] {
	if (isScopedRecord(record)) return [];
	return [...new Set(ledger)].filter((id) => id !== record.id);
}
