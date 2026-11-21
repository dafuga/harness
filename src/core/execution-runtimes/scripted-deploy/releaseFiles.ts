import { createHash } from 'node:crypto';
import { createReadStream, lstatSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { hash, sha, type Release } from './contracts';
import { runProcess } from './runProcess';
import { DeployDockerAdapter } from '../../../adapters/execution-runtimes/DeployDockerAdapter';
import {
	atomicWrite,
	type DeployRunRepository
} from '../../../repositories/execution-runtimes/DeployRunRepository';
import type { DeployProject } from '../../../validators/execution-runtimes/DeployManifestValidator';

const built = z.strictObject({
	node: z.string(),
	bun: z.string(),
	wrangler: z.string(),
	gcloud: z.string()
});
type Build = { project: string; source: string; manifest: string };

export async function buildRelease(
	store: DeployRunRepository,
	config: DeployProject,
	spec: Build
): Promise<Release> {
	const base = join(store.root, 'releases');
	mkdirSync(base, { recursive: true, mode: 0o700 });
	const work = mkdtempSync(join(base, 'building-'));
	try {
		const source = join(work, 'source.tar');
		const output = join(work, 'out');
		mkdirSync(output, { mode: 0o700 });
		await exportSource(config, spec.source, source);
		const docker = new DeployDockerAdapter({ project: config });
		const versions = built.parse(
			await docker.run('build', { '/source': source, '/out': output }, { source: spec.source })
		);
		if (hash(versions) !== hash(config.toolchain))
			throw new Error('Built release used an unexpected deploy toolchain.');
		return await preserveRelease(store, output, { ...spec, image: config.image });
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

async function preserveRelease(
	store: DeployRunRepository,
	output: string,
	input: Omit<Release, 'id' | 'artifact' | 'size'>
): Promise<Release> {
	const artifact = join(output, 'artifact.tar');
	const body = { ...input, artifact: await hashFile(artifact), size: lstatSync(artifact).size };
	const result = { id: hash(body), ...body };
	atomicWrite(join(output, 'release.json'), result);
	try {
		renameSync(output, store.releaseDirectory(result.id));
	} catch (error) {
		if (!['EEXIST', 'ENOTEMPTY'].includes((error as { code?: string }).code ?? '')) throw error;
		await verifyArtifact(store, result);
	}
	return result;
}

export async function verifyArtifact(store: DeployRunRepository, value: Release): Promise<string> {
	const file = store.artifact(value.id);
	const { id, ...body } = value;
	if (
		id !== hash(body) ||
		hash(store.getRelease(id)) !== hash(value) ||
		lstatSync(file).size !== value.size ||
		(await hashFile(file)) !== value.artifact
	) {
		throw new Error('Stored deployment artifact is missing or has changed.');
	}
	return file;
}

async function hashFile(file: string): Promise<string> {
	const stat = lstatSync(file);
	if (!stat.isFile() || !stat.size)
		throw new Error('Deployment build did not produce a regular artifact.');
	const hashing = createHash('sha256');
	for await (const bytes of createReadStream(file)) hashing.update(bytes);
	return hashing.digest('hex');
}

async function exportSource(config: DeployProject, source: string, output: string): Promise<void> {
	await validateSource(config, source);
	await git(config, ['archive', '--format=tar', '--output=' + output, source]);
}

export async function validateSource(config: DeployProject, source: string): Promise<void> {
	const remote = (
		await git(config, ['ls-remote', '--exit-code', config.repository, config.sourceRef])
	).trim();
	const commit = sha.parse(remote.split('\t')[0]);
	if (remote.split('\t')[1] !== config.sourceRef)
		throw new Error('Unexpected release source branch.');
	await git(config, ['merge-base', '--is-ancestor', sha.parse(source), commit]);
}

function git(config: DeployProject, args: string[]): Promise<string> {
	return runProcess('git', args, {
		cwd: config.checkout,
		description: 'Release source verification'
	});
}
