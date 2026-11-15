// @harness-uid u_hstidntabc
import { resolveContractRevision } from './contractRevisions';
import type {
	ContractHistoryIdentity,
	ContractHistoryReader,
	ContractLogContext,
	StoredContract
} from './contractHistory.types';

export async function currentContractIdentity(
	reader: ContractHistoryReader,
	unit: string
): Promise<ContractHistoryIdentity | undefined> {
	if (!unit) return undefined;
	const entry = (await reader.read(await resolveContractRevision(reader.git, 'HEAD'))).find(
		(item) => item.id === unit || item.uid === unit
	);
	return {
		...(entry?.uid ? { uid: entry.uid } : {}),
		aliases: new Set([entry?.id ?? unit]),
		legacy: new Set(entry && !entry.uid ? [entry.id] : []),
		pending: !entry
	};
}

/** Permit pre-uid ids only after observing their introduction into the selected stable identity. */
export function selectContractIdentity(
	context: ContractLogContext,
	before: StoredContract[],
	after: StoredContract[]
): StoredContract[][] {
	const identity = context.identity;
	if (!identity) return [before, after];
	adoptPendingIdentity(identity, [...after, ...before]);
	if (!identity.uid) adoptEarlierUid(identity, before, after);
	for (const entry of [...after, ...before])
		if (entry.uid === identity.uid && entry.uid) identity.aliases.add(entry.id);
	for (const entry of after) {
		if (!entry.uid || entry.uid !== identity.uid) continue;
		const earlier = before.find((candidate) => candidate.id === entry.id && !candidate.uid);
		if (earlier) identity.legacy.add(earlier.id);
	}
	return [before, after].map((snapshot) =>
		snapshot.filter((entry) => matchesIdentity(entry, identity))
	);
}

function adoptPendingIdentity(identity: ContractHistoryIdentity, entries: StoredContract[]): void {
	if (!identity.pending) return;
	const entry = entries.find(
		(candidate) => identity.aliases.has(candidate.id) || identity.aliases.has(candidate.uid ?? '')
	);
	if (!entry) return;
	identity.uid = entry.uid;
	identity.aliases.add(entry.id);
	if (!entry.uid) identity.legacy.add(entry.id);
	identity.pending = false;
}

function adoptEarlierUid(
	identity: ContractHistoryIdentity,
	before: StoredContract[],
	after: StoredContract[]
): void {
	const earlier = before.find(
		(entry) =>
			entry.uid &&
			after.some((next) => !next.uid && next.id === entry.id && identity.legacy.has(next.id))
	);
	if (earlier) identity.uid = earlier.uid;
}

function matchesIdentity(entry: StoredContract, identity: ContractHistoryIdentity): boolean {
	if (identity.pending) return false;
	if (entry.uid) return entry.uid === identity.uid;
	return identity.legacy.has(entry.id);
}
