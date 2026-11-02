// @harness-uid u_mh7v3mrv6e
import type { RenameOptions, RenameReport } from './renameUnit.types';
import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fail } from '../../../core/development-tooling/errors';
import { unitIdPattern, type ComponentManifest } from '../../../core/development-tooling/unitTypes';
import { unitsDirectory } from '../../../core/development-tooling/unitsConfig';
import { loadUnits } from '../load-units/loadUnits';

/**
 * Gives a unit another readable id. The uid, contract and history stay with it: the old id remains
 * as a retired tombstone the new unit continues, and every reference in the specification files
 * follows the unit. Source files are untouched, because they announce the uid and not the id.
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
	await loaded.repository.write([{ ...renamed, id: to }, tombstone(unit, to, at)]);
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

/** Replaces the id wherever a specification file holds it as a whole JSON string. */
async function rewriteReferences(root: string, from: string, to: string): Promise<string[]> {
	const directory = join(root, 'specification');
	const files = (await readdir(directory, { recursive: true })).filter((name) =>
		name.endsWith('.json')
	);
	const changed: string[] = [];
	for (const name of files) {
		const path = join(directory, name);
		const text = await readFile(path, 'utf8');
		const next = text.replaceAll(`"${from}"`, `"${to}"`);
		if (next === text) continue;
		await writeFile(path, next);
		changed.push(relative(root, path));
	}
	return changed.sort();
}
