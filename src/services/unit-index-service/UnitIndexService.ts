import type { SourceFile } from '../../core/sourceTypes';
import type { ComponentManifest } from '../../core/unitTypes';
import { deriveManifest } from './deriveManifest';
import { stableJson } from '../../utils/stableJson';
import { unitLineage } from './unitLineage';
import type { SourceIndex } from '../source-index-service/SourceIndexService';

export interface UnitMove {
	id: string;
	from: string;
	to: string;
}

export interface UnitIndexResult {
	manifests: ComponentManifest[];
	added: string[];
	updated: string[];
	moved: UnitMove[];
	revived: string[];
	orphaned: string[];
}

interface Group {
	id: string;
	kind: string;
	files: SourceFile[];
}

interface Registry {
	byId: Map<string, ComponentManifest>;
	/** Active owner of each source path. */
	owners: Map<string, string>;
	groups: Map<string, Group>;
	result: UnitIndexResult;
}

/** Reconciles the stored registry with the source tree without ever changing an identity. */
export class UnitIndexService {
	index(index: SourceIndex, existing: ComponentManifest[]): UnitIndexResult {
		const registry = this.registry(existing);
		const pending = this.claim(registry, this.groups(index));
		this.place(registry, pending, index);
		this.refresh(registry, index);
		const before = new Map(existing.map((manifest) => [manifest.id, stableJson(manifest)]));
		const fresh = new Set([
			...registry.result.added,
			...registry.result.revived,
			...registry.result.moved.map((move) => move.id)
		]);
		const manifests = [...registry.byId.values()].sort((left, right) =>
			left.id < right.id ? -1 : 1
		);
		registry.result.updated = manifests
			.filter((manifest) => !fresh.has(manifest.id))
			.filter((manifest) => before.get(manifest.id) !== stableJson(manifest))
			.map((manifest) => manifest.id);
		return { ...registry.result, manifests };
	}

	private registry(existing: ComponentManifest[]): Registry {
		const active = existing.filter((manifest) => manifest.status === 'active');
		return {
			byId: new Map(existing.map((manifest) => [manifest.id, manifest])),
			owners: new Map(active.flatMap((unit) => unit.owns.source.map((path) => [path, unit.id]))),
			groups: new Map(),
			result: { manifests: [], added: [], updated: [], moved: [], revived: [], orphaned: [] }
		};
	}

	private groups(index: SourceIndex): Group[] {
		const groups = new Map<string, Group>();
		for (const file of index.files.values()) {
			if (file.classification !== 'source' || !file.identity) continue;
			const group = groups.get(file.identity.id) ?? { ...file.identity, files: [] };
			group.files.push(file);
			groups.set(file.identity.id, group);
		}
		return [...groups.values()].sort((left, right) => (left.id < right.id ? -1 : 1));
	}

	/** Attaches unowned files to a sibling owner or a retired owner; returns the rest. */
	private claim(registry: Registry, groups: Group[]): Group[] {
		const retired = [...registry.byId.values()].filter((unit) => unit.status === 'retired');
		return groups.filter((group) => {
			const unowned = group.files.filter((file) => !registry.owners.has(file.path));
			if (unowned.length === 0) return false;
			const sibling = group.files.map((file) => registry.owners.get(file.path)).find(Boolean);
			const tomb = retired.find((unit) =>
				unowned.some((file) => unit.owns.source.includes(file.path))
			);
			const owner = sibling ?? tomb?.id;
			if (!owner) return true;
			if (!sibling) registry.result.revived.push(owner);
			for (const file of unowned) registry.owners.set(file.path, owner);
			return false;
		});
	}

	/** Treats an unowned group as a move when exactly one orphan exposes the same symbols. */
	private place(registry: Registry, pending: Group[], index: SourceIndex): void {
		const orphans = [...registry.byId.values()].filter(
			(unit) => unit.status === 'active' && unit.owns.source.every((path) => !index.files.has(path))
		);
		const matches = (group: Group) => orphans.filter((unit) => sameSymbols(unit, group));
		for (const group of pending) {
			const [orphan, ...others] = matches(group);
			const rivals = orphan ? pending.filter((other) => matches(other).includes(orphan)) : [];
			const moved = orphan && others.length === 0 && rivals.length === 1;
			const id = moved ? orphan.id : this.mint(registry, group);
			if (moved) {
				registry.result.moved.push({ id, from: orphan.owns.source[0], to: group.files[0].path });
				for (const path of orphan.owns.source) registry.owners.delete(path);
			} else registry.result.added.push(id);
			for (const file of group.files) registry.owners.set(file.path, id);
		}
	}

	private mint(registry: Registry, group: Group): string {
		let id = group.id;
		for (let suffix = 2; registry.byId.has(id) || registry.groups.has(id); suffix += 1) {
			id = `${group.id}-${suffix}`;
		}
		registry.groups.set(id, group);
		return id;
	}

	private refresh(registry: Registry, index: SourceIndex): void {
		const filesByUnit = new Map<string, SourceFile[]>();
		for (const [path, id] of registry.owners) {
			const file = index.files.get(path);
			if (file) filesByUnit.set(id, [...(filesByUnit.get(id) ?? []), file]);
		}
		registry.result.orphaned = [...registry.byId.values()]
			.filter((unit) => unit.status === 'active' && !filesByUnit.has(unit.id))
			.map((unit) => unit.id);
		const retired = [...registry.byId.values()].filter(
			(unit) => unit.status === 'retired' && !filesByUnit.has(unit.id)
		);
		for (const [id, files] of filesByUnit) {
			const symbols = files.flatMap((file) => file.exports.map((symbol) => symbol.name));
			registry.byId.set(
				id,
				deriveManifest({
					id,
					kind: registry.groups.get(id)?.kind ?? 'module',
					files,
					owners: registry.owners,
					predecessors: unitLineage({ id, symbols }, retired),
					previous: registry.byId.get(id)
				})
			);
		}
	}
}

function sameSymbols(unit: ComponentManifest, group: Group): boolean {
	const symbols = group.files.flatMap((file) => file.exports.map((symbol) => symbol.name));
	return symbols.length > 0 && symbols.join('\n') === unit.owns.symbols.join('\n');
}
