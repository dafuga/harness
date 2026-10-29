const scopedPrefix = 'Scoped to ';

interface DependentRecord {
	id: string;
	source: { baseRecord?: string | null };
	scenarios: { referencedRecord?: string | null }[];
	failures: string[];
}

/** A scoped (--entity) record proves only its own entity; it inherits and cites no other record. */
export function isScopedRecord(record: Pick<DependentRecord, 'failures'>): boolean {
	return record.failures.some((failure) => failure.startsWith(scopedPrefix));
}

/** Records a record inherits from: its base and the records behind inherited scenarios. */
export function inheritedRecords(record: DependentRecord): string[] {
	if (isScopedRecord(record)) return [];
	const inherited = record.scenarios.flatMap((scenario) => scenario.referencedRecord ?? []);
	return [...new Set([record.source.baseRecord ?? '', ...inherited])].filter(Boolean);
}

/** Records the commit's budget ledger cites, which a full record attaches first. */
export function citedRecords(record: DependentRecord, ledger: string[]): string[] {
	if (isScopedRecord(record)) return [];
	return [...new Set(ledger)].filter((id) => id !== record.id);
}
