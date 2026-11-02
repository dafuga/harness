// @harness-uid u_mh7v3mrv6e
import type { RenameOptions, RenameReport } from './renameUnit.types';
import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fail } from '../../../core/development-tooling/errors';
import { unitIdPattern, type ComponentManifest } from '../../../core/development-tooling/unitTypes';
import { unitsDirectory } from '../../../core/development-tooling/unitsConfig';
import { stableJson } from '../../../utils/development-tooling/stableJson';
import { loadUnits } from '../load-units/loadUnits';

/**
 * Gives a unit another readable id. The uid, contract and history stay with it: the old id remains
 * as a retired tombstone the new unit continues, and the unit specs that refer to it follow the unit. Source files are untouched, because they announce the uid and not the id.
 */
export async function renameUnit(
	from: string,
	to: string,
	options: RenameOptions = {}
): Promise<RenameReport> {
	const loaded = await loadUnits(options.root);
	const unit = loaded.stored.find((manifest) => manifest.id === from);
	if (unit?.status !== 'active') return fail(`Unknown active unit "${from}".`);
	if (!unitIdPattern.test(to)) return fail(`"${to}" is not a valid unit id.`);
	if (loaded.stored.some((manifest) => manifest.id === to))
		return fail(`A unit with id "${to}" exists already; ids are never reused.`);
	const rewritten = await rewriteReferences(loaded.root, from, to);
	const at = options.now?.() ?? new Date().toISOString();
	const predecessors = [...(unit.lineage?.predecessors ?? []), from];
	const renamed = { ...unit, id: to, lineage: { predecessors } } as ComponentManifest;
	await rename(
		join(loaded.root, unitsDirectory, `${from}.json`),
		join(loaded.root, unitsDirectory, `${to}.json`)
	);
	await loaded.repository.write([renamed, tombstone(unit, to, at)]);
	return { from, to, rewritten };
}

/** What stays of the old id: a retired unit that owns nothing and names its successor. */
function tombstone(unit: ComponentManifest, to: string, at: string): ComponentManifest {
	const kept = { ...unit };
	delete kept.uid;
	delete kept.lineage;
	return {
		...kept,
		status: 'retired',
		retired: { reason: `Renamed to ${to}.`, at },
		owns: { source: [], symbols: [] },
		dependencies: [],
		scenarios: []
	};
}

/**
 * Points the unit specs that refer to the old id at the new one: their dependencies, composition,
 * primitives and lineage. Scenarios, loops and evidence records are history and stay as written.
 */
async function rewriteReferences(root: string, from: string, to: string): Promise<string[]> {
	const directory = join(root, unitsDirectory);
	const changed: string[] = [];
	for (const name of (await readdir(directory)).filter((item) => item.endsWith('.json'))) {
		const path = join(directory, name);
		const text = await readFile(path, 'utf8');
		const spec = JSON.parse(text) as ComponentManifest;
		if (!retarget(spec, from, to)) continue;
		await writeFile(path, stableJson(spec));
		changed.push(relative(root, path));
	}
	return changed.sort();
}

/** Replaces the id in the known reference fields of one spec; true when anything changed. */
function retarget(spec: ComponentManifest, from: string, to: string): boolean {
	const lists = [spec.composition?.uses, spec.contract.primitives];
	const holds = (ids: string[] | undefined) => ids?.includes(from) === true;
	const changed = spec.dependencies.some((item) => item.unit === from) || lists.some(holds);
	for (const dependency of spec.dependencies) if (dependency.unit === from) dependency.unit = to;
	for (const ids of lists.filter((list) => list !== undefined))
		for (const [index, id] of ids.entries()) if (id === from) ids[index] = to;
	return changed;
}
