import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import ts from 'typescript';

const execFileAsync = promisify(execFile);

/** Metadata Bun records for a dependency; only the fields present in the packed manifest are kept. */
const tarballMetadataKeys = [
	'dependencies',
	'optionalDependencies',
	'peerDependencies',
	'peerDependenciesMeta',
	'bin'
] as const;

/**
 * Seeds the consumer's bun.lock from the repository's frozen lock, so the consumer install
 * resolves from cached entries instead of the registry. Workspace-only entries are dropped and
 * the packed tarball is appended under its manifest name.
 */
export async function seedConsumerLock(options: {
	project: string;
	tarball: string;
	consumer: Record<string, unknown>;
}): Promise<void> {
	const frozen = ts.parseConfigFileTextToJson(
		'bun.lock',
		await readFile(resolve('bun.lock'), 'utf8')
	);
	if (frozen.error !== undefined) throw new Error('Repository bun.lock is not parseable JSONC');
	const repoLock = frozen.config as {
		lockfileVersion: number;
		packages: Record<string, unknown[]>;
	};
	const tarballManifest = await readTarballManifest(options.tarball);
	const name = String(tarballManifest.name);
	const packages: Record<string, unknown[]> = {};
	for (const [key, entry] of Object.entries(repoLock.packages))
		if (!String(entry[0]).includes('@workspace:')) packages[key] = entry;
	packages[name] = [`${name}@${options.tarball}`, tarballMetadata(tarballManifest)];
	const lock = {
		lockfileVersion: repoLock.lockfileVersion,
		workspaces: { '': consumerWorkspace(options.consumer) },
		packages
	};
	await writeFile(join(options.project, 'bun.lock'), JSON.stringify(lock, null, 2));
}

/** Reads the packed package.json directly from the tarball, not from the source tree. */
async function readTarballManifest(tarball: string): Promise<Record<string, unknown>> {
	const { stdout } = await execFileAsync('tar', ['-xOf', tarball, 'package/package.json']);
	return JSON.parse(stdout) as Record<string, unknown>;
}

function tarballMetadata(manifest: Record<string, unknown>): Record<string, unknown> {
	const metadata: Record<string, unknown> = {};
	for (const key of tarballMetadataKeys)
		if (manifest[key] !== undefined) metadata[key] = manifest[key];
	return metadata;
}

function consumerWorkspace(consumer: Record<string, unknown>): Record<string, unknown> {
	const workspace: Record<string, unknown> = { name: consumer.name };
	for (const key of ['dependencies', 'devDependencies'] as const)
		if (consumer[key] !== undefined) workspace[key] = consumer[key];
	return workspace;
}
