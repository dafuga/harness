import type { Group, Registry } from './UnitIndexService.types';
import type { SourceFile } from '../../../../core/development-tooling/sourceTypes';
import type { ComponentManifest } from '../../../../core/development-tooling/unitTypes';
import type { SourceIndex } from '../../../../services/development-tooling/source-index-service/SourceIndexService';

/**
 * A file that announces the uid of a registered unit belongs to that unit wherever it lies, so
 * a moved or renamed file keeps its unit. A unit file that vanished is reported as moved.
 */
export function adoptUids(registry: Registry, index: SourceIndex): Registry {
	const byUid = new Map(
		[...registry.byId.values()].flatMap((unit) =>
			unit.status === 'active' && unit.uid ? [[unit.uid, unit] as const] : []
		)
	);
	const arrived = new Map<string, string[]>();
	for (const file of index.files.values()) {
		const unit = file.uid && file.classification === 'source' ? byUid.get(file.uid) : undefined;
		if (!unit || registry.owners.get(file.path) === unit.id) continue;
		registry.owners.set(file.path, unit.id);
		arrived.set(unit.id, [...(arrived.get(unit.id) ?? []), file.path]);
	}
	for (const [id, paths] of arrived) {
		const gone = registry.byId.get(id)?.owns.source.find((path) => !index.files.has(path));
		if (gone) registry.result.moved.push({ id, from: gone, to: paths.sort()[0] });
	}
	return registry;
}

/** Groups announcing one uid are one unit: a forwarding entry and its implementation. */
export function mergedByUid(all: Group[]): Group[] {
	const byUid = new Map<string, Group>();
	const groups = all.sort((left, right) => (left.id < right.id ? -1 : 1));
	for (const group of groups) group.uid = group.files.find((file) => file.uid)?.uid;
	return groups.filter((group) => {
		const first = group.uid ? byUid.get(group.uid) : undefined;
		if (!first) {
			if (group.uid) byUid.set(group.uid, group);
			return true;
		}
		first.files.push(...group.files);
		return false;
	});
}

/** The uid a unit keeps: the registered one, else the one its files agree on. */
export function unitUid(
	previous: ComponentManifest | undefined,
	group: Group | undefined,
	files: SourceFile[]
): string | undefined {
	if (previous?.uid) return previous.uid;
	if (group?.uid) return group.uid;
	const announced = new Set(files.flatMap((file) => (file.uid ? [file.uid] : [])));
	return announced.size === 1 ? [...announced][0] : undefined;
}
