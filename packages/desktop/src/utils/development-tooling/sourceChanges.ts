import type { SourceChange } from '../../models/development-tooling/Desktop.types';
import type { SourceSnapshot } from '../verification-evidence/sourceSnapshot';
export function sourceChanges(before: SourceSnapshot, after: SourceSnapshot): SourceChange[] {
	return [...new Set([...before.keys(), ...after.keys()])].sort().flatMap((path) => {
		if (before.get(path) === after.get(path)) return [];
		let change: SourceChange['change'] = 'modified';
		if (!before.has(path)) change = 'added';
		else if (!after.has(path)) change = 'deleted';
		return [{ path, change }];
	});
}
