// @harness-uid u_3wdb3ltytd
import { join, relative, resolve } from 'node:path';
import { unitsDirectory } from '../../../core/development-tooling/unitsConfig';
import { componentManifestSchema } from '../../../core/development-tooling/unitTypes';
import { fail } from '../../../core/development-tooling/errors';
import { contractFiles, readContractJson } from './contractDocuments';
import { attachContractStates } from './contractStates';
import type { ContractEntry } from './contracts.types';

/** Load the authoritative stored registry, including nested folders, without listing source. */
export async function readContractCatalog(
	root: string,
	includeStates = true
): Promise<ContractEntry[]> {
	const directory = join(resolve(root), unitsDirectory);
	const paths = await contractFiles(directory);
	const entries: ContractEntry[] = [];
	for (let offset = 0; offset < paths.length; offset += 64) {
		entries.push(
			...(await Promise.all(
				paths.slice(offset, offset + 64).map(async (path) => {
					const contractPath = relative(resolve(root), path).split('\\').join('/');
					const manifest = await readManifest(path, contractPath);
					return {
						id: manifest.id,
						kind: manifest.kind,
						title: manifest.title,
						path: manifest.owns.source[0] ?? manifest.runtime.entry,
						contractPath,
						responsibility: manifest.responsibility,
						manifest,
						states: []
					};
				})
			))
		);
	}
	const known = new Set<string>();
	for (const entry of entries) {
		if (known.has(entry.id)) fail(`Duplicate contract id "${entry.id}" (${entry.contractPath}).`);
		known.add(entry.id);
	}
	if (includeStates) await attachContractStates(entries, root);
	return entries.sort((left, right) => left.id.localeCompare(right.id));
}

async function readManifest(path: string, label: string) {
	const parsed = await readContractJson(path, label);
	const checked = componentManifestSchema.safeParse(parsed);
	if (!checked.success) {
		const issue = checked.error.issues[0];
		return fail(`Invalid contract ${label}: ${issue.path.join('.')}: ${issue.message}`);
	}
	return checked.data;
}
