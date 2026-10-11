import { cp, rm } from 'node:fs/promises';
import { BuildIdentityService } from '../../../../src/services/BuildIdentityService';

export interface FrozenBuild {
	/** The directory one run serves from. */
	build: string;
	buildId: string;
	files: number;
}

/**
 * Copies a finished build to where one run serves it from. A built server loads its files as
 * they are asked for, so a rebuild of the directory it was started from replaces what it has
 * not loaded yet; a run therefore never serves that directory itself. The identity of the
 * source is taken before and after the copy and compared with the copy's own: a directory that
 * holds no build, or one that changed meanwhile, is refused by name and nothing is left of the copy.
 */
export async function frozenBuild(
	source: string,
	target: string,
	copied: (from: string, to: string) => Promise<void> = (from, to) =>
		cp(from, to, { recursive: true })
): Promise<FrozenBuild> {
	const identities = new BuildIdentityService();
	const before = await identities.identify(source);
	if (!before) throw new Error(`${source} holds no build: build the reports package first.`);
	await rm(target, { recursive: true, force: true });
	await copied(source, target);
	const [copy, after] = [await identities.identify(target), await identities.identify(source)];
	if (copy?.buildId === before.buildId && after?.buildId === before.buildId) {
		return { build: target, buildId: before.buildId, files: before.files };
	}
	await rm(target, { recursive: true, force: true });
	const now = after?.buildId.slice(0, 12) ?? 'nothing';
	throw new Error(
		`${source} changed while this run was copying it (${before.buildId.slice(0, 12)}, then ${now}): another build is running in this checkout. A checkout has one build at a time; wait for it, or use another worktree or a verification snapshot.`
	);
}
