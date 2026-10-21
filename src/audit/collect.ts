import { lstat, readdir } from 'node:fs/promises';
import { extname } from 'node:path';
import { join } from 'node:path';

const ignoredDirs = new Set([
	'.cache',
	'.git',
	'.gradle',
	'.svelte-kit',
	'.wrangler',
	'.wxt',
	'__screenshots__',
	'android',
	'build',
	'coverage',
	'dist',
	'ios',
	'node_modules',
	'Pods',
	'playwright-report',
	'target',
	'test-results',
	'tmp'
]);

export interface CollectedFile {
	path: string;
	extension: string;
}

export interface CollectedFiles {
	files: CollectedFile[];
	dirs: string[];
	ignoredPaths: string[];
}

interface CollectionPolicy {
	excluded: ReadonlySet<string>;
	includeNativeSources: boolean;
}

export async function collectAuditedFiles(
	root: string,
	options: { includeNativeSources?: boolean } = {}
): Promise<CollectedFiles> {
	const includeNativeSources = options.includeNativeSources === true;
	const excluded = includeNativeSources
		? new Set([
				...[...ignoredDirs].filter((name) => name !== 'ios' && name !== 'android'),
				'DerivedData',
				'xcuserdata',
				'.externalNativeBuild',
				'.cxx',
				'capacitor-cordova-ios-plugins',
				'capacitor-cordova-android-plugins'
			])
		: ignoredDirs;
	return collectFiles(root, '', { excluded, includeNativeSources });
}

async function collectFiles(
	root: string,
	prefix: string,
	policy: CollectionPolicy
): Promise<CollectedFiles> {
	const entries = await readdir(root);
	const nested = await Promise.all(
		entries.map((entry) => collectEntry(root, entry, prefix, policy))
	);

	return {
		files: nested.flatMap((result) => result.files),
		dirs: nested.flatMap((result) => result.dirs),
		ignoredPaths: nested.flatMap((result) => result.ignoredPaths)
	};
}

async function collectEntry(
	root: string,
	entry: string,
	prefix: string,
	policy: CollectionPolicy
): Promise<CollectedFiles> {
	const path = join(root, entry);
	const details = await lstat(path);
	const relativePath = prefix ? `${prefix}/${entry}` : entry;

	if (details.isSymbolicLink()) {
		return { files: [], dirs: [], ignoredPaths: [relativePath] };
	}

	if (details.isDirectory()) {
		return ignoredDirectory(entry, relativePath, policy)
			? { files: [], dirs: [], ignoredPaths: [`${relativePath}/`] }
			: collectDirectory(path, relativePath, policy);
	}

	return { files: [{ path, extension: extname(entry).toLowerCase() }], dirs: [], ignoredPaths: [] };
}

async function collectDirectory(
	path: string,
	relativePath: string,
	policy: CollectionPolicy
): Promise<CollectedFiles> {
	const collected = await collectFiles(path, relativePath, policy);
	return {
		files: collected.files,
		dirs: [`${relativePath}/`, ...collected.dirs],
		ignoredPaths: collected.ignoredPaths
	};
}

/** Native web bundles are generated; ordinary public source directories remain visible. */
function ignoredDirectory(name: string, path: string, policy: CollectionPolicy): boolean {
	return (
		policy.excluded.has(name) ||
		(policy.includeNativeSources &&
			/(?:^|\/)ios\/App\/(?:output|App\/public)(?:\/|$)|(?:^|\/)android\/app\/src\/main\/assets(?:\/|$)/.test(
				path
			))
	);
}
