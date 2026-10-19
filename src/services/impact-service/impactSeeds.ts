import { ImpactSeeds } from '../../utils/impactSeeds';
import type { ImpactSide } from "../../core/impactTypes";
import type { UncertainNode } from "../../core/sourceTypes";
import { scenariosDirectory, unitsDirectory } from "../../core/unitsConfig";
import { classifyPath } from "../../utils/classify-path/classifyPath";
import type { TreeChange } from "../../utils/treeChanges";

interface Sides {
	base: ImpactSide;
	head: ImpactSide;
}

/** Turns changed paths into kernel seeds, never dropping a path it cannot classify. */
export function impactSeeds(changes: TreeChange[], sides: Sides): ImpactSeeds {
	const result: ImpactSeeds = { changed: [], seeds: [], direct: new Set(), expansions: [] };
	for (const change of changes) {
		const side = change.status === 'removed' ? sides.base : sides.head;
		const { classification } = classifyPath(change.path, side.config);
		const unit =
			registryUnit(change.path) ?? owner(change.path, side) ?? owner(change.path, sides.base);
		result.changed.push({ ...change, classification, ...(unit ? { unit } : {}) });
		if (unit) result.direct.add(unit);
		if (classification === 'ignored') continue;
		result.seeds.push(...seedsFor(change.path, sides));
		const reason = expansionReason(classification);
		if (reason) {
			result.expansions.push({ node: `file:${change.path}`, reason, detail: change.path });
		}
	}
	return result;
}

function expansionReason(classification: string): UncertainNode['reason'] | undefined {
	if (classification === 'global') return 'global-change';
	return classification === 'other' ? 'unclassified-change' : undefined;
}

function registryUnit(path: string): string | undefined {
	const prefix = `${unitsDirectory}/`;
	return path.startsWith(prefix) && path.endsWith('.json')
		? path.slice(prefix.length, -5)
		: undefined;
}

function owner(path: string, side: ImpactSide): string | undefined {
	return side.manifests.find((unit) => unit.status === 'active' && unit.owns.source.includes(path))
		?.id;
}

/** A changed manifest seeds its unit and the unit's files, so the unit's own tests rerun. */
function seedsFor(path: string, sides: Sides): string[] {
	const unit = registryUnit(path);
	if (unit) {
		const owned = [sides.base, sides.head].flatMap(
			(side) => side.manifests.find((manifest) => manifest.id === unit)?.owns.source ?? []
		);
		return [`unit:${unit}`, ...owned.map((file) => `file:${file}`)];
	}
	const prefix = `${scenariosDirectory}/`;
	if (path.startsWith(prefix) && path.endsWith('.json')) {
		return [`scenario:${path.slice(prefix.length, -5)}`];
	}
	return [`file:${path}`];
}
