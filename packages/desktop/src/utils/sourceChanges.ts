import type { SourceChange } from '../models/Desktop.types';
import type { SourceSnapshot } from './sourceSnapshot';
export function sourceChanges(before: SourceSnapshot, after: SourceSnapshot): SourceChange[] {
	return [...new Set([...before.keys(), ...after.keys()])].sort().flatMap((path) => {
		if (before.get(path) === after.get(path)) return [];
		let change: SourceChange['change'] = 'modified';
		if (!before.has(path)) change = 'added';
		else if (!after.has(path)) change = 'deleted';
		return [{ path, change }];
	});
}
