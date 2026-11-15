// @harness-uid u_hstsemabcd
import type { ContractFieldChange } from './contractHistory.types';

const namedCollections = new Set([
	'inputs',
	'outputs',
	'errors',
	'operations',
	'props',
	'events',
	'states',
	'helperContracts',
	'initialization'
]);
const setCollections = new Set(['owns.source', 'owns.symbols', 'scenarios', 'runtime.targets']);

/** Only declared metadata collections ignore order; examples and unknown JSON remain ordered. */
function contractArrayMode(path: string, values: unknown[]): 'named' | 'set' | 'ordered' {
	if (/(^|\.)examples(?:\[|\.|$)/.test(path)) return 'ordered';
	if (path === 'dependencies' || setCollections.has(path)) return 'set';
	const key = path.split('.').at(-1) ?? '';
	return namedCollections.has(key) && values.every((item) => itemKey(item) !== undefined)
		? 'named'
		: 'ordered';
}

export function canonicalContract(data: unknown, path = '', ordered = false): string {
	if (Array.isArray(data)) {
		const items = data.map((item, index) => canonicalContract(item, `${path}[${index}]`, ordered));
		if (!ordered && contractArrayMode(path, data) !== 'ordered') items.sort();
		return `[${items.join(',')}]`;
	}
	if (isRecord(data))
		return `{${Object.keys(data)
			.sort()
			.map(
				(key) =>
					`${JSON.stringify(key)}:${canonicalContract(data[key], joinPath(path, key), ordered)}`
			)
			.join(',')}}`;
	return JSON.stringify(data) ?? 'undefined';
}

export function compareContractFields(
	before: unknown,
	after: unknown,
	path = ''
): ContractFieldChange[] {
	if (canonicalContract(before, path) === canonicalContract(after, path)) return [];
	if (isRecord(before) || isRecord(after)) return compareRecords(before, after, path);
	if (Array.isArray(before) || Array.isArray(after)) return compareArrays(before, after, path);
	return atomicChange(before, after, path);
}

function compareRecords(before: unknown, after: unknown, path: string): ContractFieldChange[] {
	if ((before !== undefined && !isRecord(before)) || (after !== undefined && !isRecord(after)))
		return atomicChange(before, after, path);
	const left = before ?? {};
	const right = after ?? {};
	const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
	return keys.length
		? keys.flatMap((key) => compareContractFields(left[key], right[key], joinPath(path, key)))
		: atomicChange(before, after, path);
}

function compareArrays(before: unknown, after: unknown, path: string): ContractFieldChange[] {
	if (
		(before !== undefined && !Array.isArray(before)) ||
		(after !== undefined && !Array.isArray(after))
	)
		return atomicChange(before, after, path);
	const left = (before ?? []) as unknown[];
	const right = (after ?? []) as unknown[];
	if (!left.length && !right.length) return atomicChange(before, after, path);
	const mode = contractArrayMode(path, [...left, ...right]);
	if (mode === 'ordered')
		return Array.from({ length: Math.max(left.length, right.length) }, (_, index) =>
			compareContractFields(left[index], right[index], `${path}[${index}]`)
		).flat();
	return compareCollection(left, right, path);
}

function compareCollection(left: unknown[], right: unknown[], path: string): ContractFieldChange[] {
	const grouped = (items: unknown[]) => {
		const groups = new Map<string, unknown[]>();
		for (const item of items) {
			const key =
				path === 'dependencies'
					? dependencyKey(item)
					: (itemKey(item) ?? canonicalContract(item, path));
			groups.set(key, [...(groups.get(key) ?? []), item]);
		}
		return groups;
	};
	const before = grouped(left),
		after = grouped(right);
	return [...new Set([...before.keys(), ...after.keys()])].sort().flatMap((key) => {
		const previous = before.get(key) ?? [],
			next = [...(after.get(key) ?? [])];
		const unmatched = previous.filter((item) => {
			const found = next.findIndex(
				(candidate) => canonicalContract(item, path) === canonicalContract(candidate, path)
			);
			if (found < 0) return true;
			next.splice(found, 1);
			return false;
		});
		return Array.from({ length: Math.max(unmatched.length, next.length) }, (_, index) => {
			const compare =
				path === 'dependencies' && (unmatched[index] === undefined || next[index] === undefined)
					? atomicChange
					: compareContractFields;
			return compare(
				unmatched[index],
				next[index],
				`${path}[${key}${index ? `#${index + 1}` : ''}]`
			);
		}).flat();
	});
}

function atomicChange(before: unknown, after: unknown, path: string): ContractFieldChange[] {
	return [
		{
			path: displayPath(path),
			kind: fieldChangeKind(before, after),
			...(before === undefined ? {} : { before }),
			...(after === undefined ? {} : { after })
		}
	];
}

function fieldChangeKind(before: unknown, after: unknown): ContractFieldChange['kind'] {
	if (before === undefined) return 'added';
	return after === undefined ? 'removed' : 'changed';
}

function itemKey(item: unknown): string | undefined {
	if (!isRecord(item)) return undefined;
	for (const key of ['name', 'uid', 'id']) if (typeof item[key] === 'string') return item[key];
	return undefined;
}

function dependencyKey(item: unknown): string {
	if (!isRecord(item)) return canonicalContract(item);
	return `${String(item.unit ?? '')};via=${String(item.via ?? '')};relation=${String(item.relation ?? item.type ?? '')}`;
}

export function isRecord(data: unknown): data is Record<string, unknown> {
	return data !== null && typeof data === 'object' && !Array.isArray(data);
}

function joinPath(path: string, key: string): string {
	return path ? `${path}.${key}` : key;
}
function displayPath(path: string): string {
	return path.replace(/^contract\./, '') || '$';
}
