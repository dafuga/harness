// @harness-uid u_hbdc5y2sd2
import type { UidFinding } from './uidFindings.types';
export type * from './uidFindings.types';
import type { SourceFile } from '../../core/development-tooling/sourceTypes';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import { uidComment } from '../../utils/development-tooling/unitUid';

/**
 * Where a unit's stable uid is missing, disagrees with its source or is held twice. Only active
 * units are reviewed, and only files that take a comment need to announce it. A registry in which
 * no unit has a uid yet has not adopted them, and is not reviewed until it is backfilled.
 */
export function uidFindings(
	units: ComponentManifest[],
	files: ReadonlyMap<string, SourceFile>,
	scope: ReadonlySet<string> | undefined = undefined
): UidFinding[] {
	const active = units.filter((unit) => unit.status === 'active');
	if (!active.some((unit) => unit.uid)) return [];
	const holders = new Map<string, string[]>();
	for (const unit of active)
		if (unit.uid) holders.set(unit.uid, [...(holders.get(unit.uid) ?? []), unit.id]);
	return active
		.filter((unit) => !scope || scope.has(unit.id))
		.flatMap((unit) => [
			...registryFindings(unit, holders),
			...unit.owns.source.flatMap((path) => fileFindings(unit, files.get(path), holders))
		]);
}

function registryFindings(unit: ComponentManifest, holders: Map<string, string[]>): UidFinding[] {
	const where = `specification/units/${unit.id}.json`;
	if (!unit.uid)
		return [{ unit: unit.id, kind: 'uid-missing', detail: 'The unit has no uid.', where }];
	const others = (holders.get(unit.uid) ?? []).filter((id) => id !== unit.id);
	if (!others.length) return [];
	const detail = `The uid ${unit.uid} is also held by ${others.join(', ')}.`;
	return [{ unit: unit.id, kind: 'uid-duplicate', detail, where }];
}

function fileFindings(
	unit: ComponentManifest,
	file: SourceFile | undefined,
	holders: Map<string, string[]>
): UidFinding[] {
	if (!file || !unit.uid) return [];
	const finding = (kind: UidFinding['kind'], detail: string): UidFinding[] => [
		{ unit: unit.id, kind, detail, where: file.path }
	];
	if (!file.uid)
		return uidComment(file.path, unit.uid)
			? finding('uid-missing', `The file does not announce the uid ${unit.uid}.`)
			: [];
	if (file.uid === unit.uid) return [];
	const holder = holders.get(file.uid)?.[0];
	return holder
		? finding('uid-copied', `The file announces ${file.uid}, which belongs to ${holder}.`)
		: finding('uid-mismatch', `The file announces ${file.uid}, not ${unit.uid}.`);
}
