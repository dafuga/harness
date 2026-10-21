import type { TreeChange } from '../../utils/treeChanges';
import type { TreeEntry } from '../../core/sourceTypes';

/** Compares two tree listings by content hash; a rename is a removal and an addition. */
export function treeChanges(base: TreeEntry[], head: TreeEntry[]): TreeChange[] {
	const before = new Map(base.map((entry) => [entry.path, entry.hash]));
	const after = new Map(head.map((entry) => [entry.path, entry.hash]));
	const changes: TreeChange[] = [];
	for (const [path, hash] of after) {
		const previous = before.get(path);
		if (previous === undefined) changes.push({ path, status: 'added' });
		else if (previous !== hash) changes.push({ path, status: 'modified' });
	}
	for (const path of before.keys()) {
		if (!after.has(path)) changes.push({ path, status: 'removed' });
	}
	return changes.sort((left, right) => (left.path < right.path ? -1 : 1));
}
