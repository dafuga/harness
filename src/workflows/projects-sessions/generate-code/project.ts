import type { PackageManifest } from './project.types';
import type { DetectedProjectKind } from '../../../core/projects-sessions/project';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function detectProjectKind(root: string): Promise<DetectedProjectKind> {
	const manifest = await readPackage(root);
	const explicitKind = explicitProjectKind(manifest);

	if (explicitKind) {
		return explicitKind;
	}

	if (await hasFile(root, 'svelte.config.js')) {
		return 'app';
	}

	if (hasSvelteKit(manifest)) {
		return 'app';
	}

	if (manifest && (await hasFile(root, 'src/index.ts'))) {
		return 'lib';
	}

	return 'unknown';
}

/** The game dimension declared in package.json harness metadata, when it is a supported one. */
export async function detectGameDimension(root: string): Promise<'2d' | '3d' | undefined> {
	const dimension = (await readPackage(root))?.harness?.dimension;
	return dimension === '2d' || dimension === '3d' ? dimension : undefined;
}

function explicitProjectKind(
	manifest: PackageManifest | undefined
): DetectedProjectKind | undefined {
	if (
		manifest?.harness?.kind === 'app' ||
		manifest?.harness?.kind === 'lib' ||
		manifest?.harness?.kind === 'game'
	) {
		return manifest.harness.kind;
	}

	return undefined;
}

async function readPackage(root: string): Promise<PackageManifest | undefined> {
	try {
		return JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as PackageManifest;
	} catch {
		return undefined;
	}
}

async function hasFile(root: string, path: string): Promise<boolean> {
	try {
		await access(join(root, path));
		return true;
	} catch {
		return false;
	}
}

function hasSvelteKit(manifest: PackageManifest | undefined): boolean {
	const deps = { ...manifest?.dependencies, ...manifest?.devDependencies };
	return '@sveltejs/kit' in deps || Boolean(manifest?.scripts?.check?.includes('svelte-kit'));
}

export type { DetectedProjectKind } from '../../../core/projects-sessions/project';
