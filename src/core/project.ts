import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type DetectedProjectKind = 'app' | 'lib' | 'unknown';

interface PackageManifest {
	frame?: {
		kind?: string;
	};
	scripts?: Record<string, string>;
	devDependencies?: Record<string, string>;
	dependencies?: Record<string, string>;
}

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

function explicitProjectKind(manifest: PackageManifest | undefined): DetectedProjectKind | undefined {
	if (manifest?.frame?.kind === 'app' || manifest?.frame?.kind === 'lib') {
		return manifest.frame.kind;
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
