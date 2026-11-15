// @harness-uid u_2mvldqu3ih
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fail } from '../../../core/development-tooling/errors';
import type { ContractEntry, ContractOptions, ContractSummary } from './contracts.types';

/** Paths are project-root relative; lexical boundaries also work for missing source files. */
export function contractPath(root: string, query: string): string {
	const path = relative(resolve(root), isAbsolute(query) ? query : resolve(root, query));
	if (path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path))
		return fail('Contract paths must stay within the project root; target is outside it.');
	return path.split(sep).join('/').replace(/\/$/, '');
}

function containsPath(parent: string, path: string): boolean {
	return parent === '' || path === parent || path.startsWith(`${parent}/`);
}

export function selectContracts(
	entries: ContractEntry[],
	target: string,
	root: string
): ContractEntry[] {
	const identity = entries.find((entry) => entry.id === target);
	if (identity) return [identity];
	const path = contractPath(root, target);
	return entries.filter(
		(entry) =>
			entry.contractPath === path ||
			entry.manifest.owns.source.some((source) => containsPath(path, source))
	);
}

export function filterContracts(
	entries: ContractEntry[],
	options: ContractOptions
): ContractEntry[] {
	const folder =
		options.folder === undefined
			? undefined
			: contractPath(options.root ?? process.cwd(), options.folder);
	return entries.filter((entry) => {
		if (entry.manifest.status !== 'active' && !options.includeRetired) return false;
		if (options.kind && entry.kind !== options.kind) return false;
		if (
			folder !== undefined &&
			!entry.manifest.owns.source.some((path) => containsPath(folder, path))
		)
			return false;
		return (
			!options.area ||
			entry.id === options.area ||
			entry.id.startsWith(`${options.area}.`) ||
			entry.manifest.owns.source.some((path) => path.split('/').includes(options.area!))
		);
	});
}

export function contractSummary(entry: ContractEntry): ContractSummary {
	return {
		id: entry.id,
		kind: entry.kind,
		title: entry.title,
		path: entry.path,
		contractPath: entry.contractPath,
		responsibility: entry.responsibility
	};
}
