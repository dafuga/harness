import type {
	TrackerSpokeJournalEntry,
	TrackerSpokeOperation
} from '../../../../src/services/projects-sessions/TrackerSpokeSyncService.types';

export const fixtureNode = 'fixture-spoke';
export const fixtureSecret = 'synthetic spoke signing key';

export function fixtureOperation(id: string, node = fixtureNode): TrackerSpokeOperation {
	return {
		op_id: id,
		item_id: `item-${id}`,
		hlc: `fixture-${id}`,
		node,
		fields: { title: 'Café ☕' }
	};
}

export function createSpokeJournal(node = fixtureNode, initial: TrackerSpokeOperation[] = []) {
	const meta = new Map<string, string>();
	const entries: TrackerSpokeJournalEntry[] = [];
	const ids = new Set<string>();
	const applyOps = (operations: readonly TrackerSpokeOperation[]) => {
		let applied = 0;
		for (const operation of operations) {
			if (ids.has(operation.op_id)) continue;
			ids.add(operation.op_id);
			entries.push({ ...operation, seq: entries.length + 1 });
			applied++;
		}
		return applied;
	};
	applyOps(initial);
	return {
		node,
		entries,
		getMeta: (key: string) => meta.get(key) ?? null,
		writeMeta: (values: Readonly<Record<string, string>>) => {
			for (const [key, value] of Object.entries(values)) meta.set(key, value);
		},
		opsSince: (since: number, limit: number, filter?: { onlyNode?: string }) =>
			entries
				.filter(({ seq, node }) => seq > since && (!filter?.onlyNode || node === filter.onlyNode))
				.slice(0, limit),
		applyOps,
		maxSeq: () => entries.length
	};
}
