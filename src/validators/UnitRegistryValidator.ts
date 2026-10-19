import type { ComponentManifest } from '../core/unitTypes';
import { unitLineage } from "../services/unit-index-service/unitLineage";

/** Checks relationships between manifests that no single manifest can prove alone. */
export class UnitRegistryValidator {
	validate(manifests: ComponentManifest[], files: ReadonlySet<string>): string[] {
		const active = manifests.filter((manifest) => manifest.status === 'active');
		const known = new Set(active.map((manifest) => manifest.id));
		return [
			...active.flatMap((unit) => this.missingSource(unit, files)),
			...active.flatMap((unit) => this.unknownDependencies(unit, known)),
			...this.sharedSource(active),
			...active.flatMap((unit) => this.lineage(unit, manifests))
		];
	}

	/** Lineage to retired identities must be recorded and must point at known units. */
	private lineage(unit: ComponentManifest, manifests: ComponentManifest[]): string[] {
		const recorded = unit.lineage?.predecessors ?? [];
		const known = new Set(manifests.map((manifest) => manifest.id));
		const expected = unitLineage({ id: unit.id, symbols: unit.owns.symbols }, manifests);
		return [
			...expected
				.filter((id) => !recorded.includes(id))
				.map((id) => `${unit.id} must record lineage to retired unit ${id}`),
			...recorded
				.filter((id) => !known.has(id))
				.map((id) => `${unit.id} names unknown predecessor ${id}`)
		];
	}

	private missingSource(unit: ComponentManifest, files: ReadonlySet<string>): string[] {
		return unit.owns.source
			.filter((path) => !files.has(path))
			.map((path) => `${unit.id} owns missing source ${path}`);
	}

	private unknownDependencies(unit: ComponentManifest, known: ReadonlySet<string>): string[] {
		return unit.dependencies
			.filter((dependency) => !known.has(dependency.unit))
			.map((dependency) => `${unit.id} depends on unknown unit ${dependency.unit}`);
	}

	private sharedSource(active: ComponentManifest[]): string[] {
		const owners = new Map<string, string[]>();
		for (const unit of active) {
			for (const path of unit.owns.source) owners.set(path, [...(owners.get(path) ?? []), unit.id]);
		}
		return [...owners.entries()]
			.filter(([, ids]) => ids.length > 1)
			.map(([path, ids]) => `${path} is owned by ${ids.join(' and ')}`);
	}
}
