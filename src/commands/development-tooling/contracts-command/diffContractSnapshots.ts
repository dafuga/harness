// @harness-uid u_hstdiffabc
import { contractPath } from './contractSelection';
import { canonicalContract, compareContractFields } from './contractSemantics';
import { fail } from '../../../core/development-tooling/errors';
import type {
	ContractChange,
	ContractDiff,
	ContractHistoryOptions,
	ContractChangeSummary,
	ContractFieldCounts,
	StoredContract
} from './contractHistory.types';

/** Compare raw stored documents; current schema defaults and unknown-key stripping never apply. */
export function diffContractSnapshots(
	before: StoredContract[],
	after: StoredContract[],
	options: ContractHistoryOptions
): ContractDiff {
	validateHistoryFields(options.field);
	const byUid = new Map(before.filter((entry) => entry.uid).map((entry) => [entry.uid, entry]));
	const byId = new Map(before.map((entry) => [entry.id, entry]));
	const used = new Set<StoredContract>();
	const pairs = after.map((entry) => {
		const matched = previousIdentity(entry, byUid, byId);
		const previous = matched && !used.has(matched) ? matched : undefined;
		if (previous) used.add(previous);
		return [previous, entry];
	});
	pairs.push(...before.filter((entry) => !used.has(entry)).map((entry) => [entry, undefined]));
	const result: ContractDiff = {
		base: '',
		head: '',
		summary: emptyContractSummary(),
		total: 0,
		truncated: false,
		changes: []
	};
	for (const [previous, next] of pairs) {
		if (![previous, next].some((entry) => entry && matchesHistoryContract(entry, options)))
			continue;
		const moved = contractMoved(previous, next);
		const fields = compareContractFields(previous?.data, next?.data);
		if (!fields.length && !moved) {
			countIgnored(result, previous, next);
			continue;
		}
		const selected = fields.filter((field) => matchesHistoryField(field.path, options.field));
		if (options.field && !selected.length) continue;
		const change = contractChange(previous, next, selected, Boolean(moved));
		result.changes.push(change);
		result.summary[change.kind]++;
		result.summary.fields += selected.length;
	}
	result.changes.sort((left, right) => left.id.localeCompare(right.id));
	result.total = result.summary.contracts = result.changes.length;
	result.changes = result.changes.slice(0, options.limit);
	result.truncated = result.changes.length < result.total;
	return result;
}

function emptyContractSummary(): ContractChangeSummary {
	return {
		contracts: 0,
		added: 0,
		removed: 0,
		moved: 0,
		changed: 0,
		fields: 0,
		formattingOnlyFiles: 0,
		reorderedOnlyFiles: 0
	};
}

function contractChange(
	before: StoredContract | undefined,
	after: StoredContract | undefined,
	fields: ContractChange['fields'],
	moved: boolean
): ContractChange {
	const current = (after ?? before)!;
	return {
		id: current.id,
		...(before && before.id !== current.id ? { previousId: before.id } : {}),
		kind: contractChangeKind(before, after, moved),
		contractPath: current.contractPath,
		...(before && before.contractPath !== current.contractPath
			? { previousContractPath: before.contractPath }
			: {}),
		sourcePaths: current.sourcePaths,
		fieldCounts: fieldCounts(fields),
		fields
	};
}

function fieldCounts(fields: ContractChange['fields']): ContractFieldCounts {
	const counts = { added: 0, removed: 0, changed: 0 };
	for (const field of fields) counts[field.kind]++;
	return counts;
}

function matchesHistoryContract(entry: StoredContract, options: ContractHistoryOptions): boolean {
	if (!matchesHistoryIdentity(entry, options.unit)) return false;
	if (options.kind && entry.kind !== options.kind) return false;
	if (options.folder !== undefined) {
		const folder = contractPath(options.root ?? process.cwd(), options.folder);
		if (
			![entry.contractPath, ...entry.sourcePaths].some((path) => containsHistoryPath(folder, path))
		)
			return false;
	}
	return matchesHistoryArea(entry, options.area);
}

function matchesHistoryArea(entry: StoredContract, area?: string): boolean {
	return (
		!area ||
		entry.id === area ||
		entry.id.startsWith(`${area}.`) ||
		entry.sourcePaths.some((path) => path.split('/').includes(area))
	);
}

function matchesHistoryIdentity(entry: StoredContract, unit?: string): boolean {
	return !unit || unit === entry.id || unit === entry.uid;
}

function previousIdentity(
	entry: StoredContract,
	byUid: Map<string | undefined, StoredContract>,
	byId: Map<string, StoredContract>
): StoredContract | undefined {
	const uidMatch = entry.uid ? byUid.get(entry.uid) : undefined;
	if (uidMatch) return uidMatch;
	const idMatch = byId.get(entry.id);
	return idMatch && (!entry.uid || !idMatch.uid) ? idMatch : undefined;
}

function contractMoved(
	before: StoredContract | undefined,
	after: StoredContract | undefined
): boolean {
	if (!before || !after) return false;
	return (
		before.id !== after.id ||
		before.contractPath !== after.contractPath ||
		canonicalContract(before.sourcePaths, 'owns.source') !==
			canonicalContract(after.sourcePaths, 'owns.source')
	);
}

function contractChangeKind(
	before: StoredContract | undefined,
	after: StoredContract | undefined,
	moved: boolean
): ContractChange['kind'] {
	if (!before) return 'added';
	if (!after) return 'removed';
	return moved ? 'moved' : 'changed';
}

function containsHistoryPath(folder: string, path: string): boolean {
	return folder === '' || path === folder || path.startsWith(`${folder}/`);
}

function countIgnored(
	result: ContractDiff,
	before: StoredContract | undefined,
	after: StoredContract | undefined
): void {
	if (!before || !after || before.raw === after.raw) return;
	if (canonicalContract(before.data, '', true) === canonicalContract(after.data, '', true))
		result.summary.formattingOnlyFiles++;
	else result.summary.reorderedOnlyFiles++;
}

export function validateHistoryFields(field?: string): void {
	if (
		field
			?.split(',')
			.some((part) => !['type', 'description', 'examples', 'errors', 'dependencies'].includes(part))
	)
		fail(
			'Unknown contract field filter; choose type, description, examples, errors or dependencies (comma-separated).'
		);
}

function matchesHistoryField(path: string, field?: string): boolean {
	if (!field) return true;
	return field.split(',').some((part) => {
		if (part === 'type') return /(^|\.)type$/.test(path);
		if (part === 'description') return /(^|\.)(description|responsibility)$/.test(path);
		if (part === 'errors') return /(^|\.)(errors(?:\[|\.|$)|errorStatus$)/.test(path);
		return new RegExp(`(^|\\.)${part}(\\[|\\.|$)`).test(path);
	});
}
