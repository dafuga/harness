import type {
	DeclaredBuild,
	BuiltIdentity,
	IdentifiedBuild,
	Scanned
} from './BuildIdentityService.types';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fail } from '../../core/development-tooling/errors';
import { buildIdentity, builtFileHash } from '../../utils/accounts-access/buildIdentity';
import { buildStampPattern } from '../../utils/development-tooling/buildStamp';

/** Reads a build directory and reports the identity of the files it holds. */
export class BuildIdentityService {
	/** Identifies each declared build under `root` and names the ones nothing was built for. */
	async declared(
		root: string,
		builds: DeclaredBuild[]
	): Promise<{ found: BuiltIdentity[]; failures: string[] }> {
		const found: BuiltIdentity[] = [];
		const failures: string[] = [];
		for (const build of builds) {
			const directory = resolve(root, build.directory);
			const inside = directory.startsWith(`${resolve(root)}${sep}`);
			const identified = inside ? await this.identify(directory) : undefined;
			const foreign = identified ? otherStamp(build, identified) : undefined;
			if (foreign) failures.push(foreign);
			else if (identified) found.push({ ...build, ...identified });
			else if (inside) failures.push(notProduced(build));
			else failures.push(`build ${build.id} names a directory outside the repository`);
		}
		return { found, failures };
	}

	/** Builds whose files no longer match the identity computed for them earlier. */
	async changed(root: string, builds: BuiltIdentity[]): Promise<string[]> {
		const now = await this.declared(root, builds);
		const current = new Map(now.found.map((build) => [build.id, build.buildId]));
		return builds
			.filter((build) => current.get(build.id) !== build.buildId)
			.map(
				(build) => `build ${build.id} changed while checks ran, so no capture can be tied to it`
			);
	}

	/**
	 * Undefined when the directory is missing or holds no file: nothing was built there. When
	 * the files were stamped, the stamp found in them is reported beside their identity.
	 */
	async identify(directory: string): Promise<IdentifiedBuild | undefined> {
		const files = await this.files(directory);
		if (files.length === 0) return undefined;
		const buildId = buildIdentity(files);
		const stamps = files.flatMap((file) => file.stamps);
		const stamp = stamps.find((found) => found !== buildId) ?? stamps[0];
		return { buildId, files: files.length, ...(stamp ? { stamp } : {}) };
	}

	/**
	 * Writes the identity of the files into every stamp slot they hold, for a server that
	 * cannot read its own files and so has to carry what it reports.
	 */
	async stamp(directory: string): Promise<IdentifiedBuild> {
		const files = await this.files(directory);
		const slotted = files.filter((file) => file.slots > 0);
		if (slotted.length === 0)
			return fail(`${directory} has no stamp slot: nothing in it reports a build identity.`);
		const buildId = buildIdentity(files);
		for (const { file } of slotted) {
			const text = (await readFile(file)).toString('latin1');
			await writeFile(file, text.replace(buildStampPattern, `harness-build:${buildId}`), 'latin1');
		}
		return { buildId, files: files.length, stamp: buildId };
	}

	private async files(directory: string): Promise<Scanned[]> {
		const entries = await readdir(directory, { withFileTypes: true, recursive: true }).catch(
			() => []
		);
		const paths = entries
			.filter((entry) => entry.isFile())
			.map((entry) => join(entry.parentPath, entry.name));
		return Promise.all(
			paths.map(async (file) => {
				const path = relative(directory, file).split(sep).join('/');
				return { path, file, ...builtFileHash(await readFile(file)) };
			})
		);
	}
}

function otherStamp(build: DeclaredBuild, found: IdentifiedBuild): string | undefined {
	if (!found.stamp || found.stamp === found.buildId) return undefined;
	return `build ${build.id} carries the stamp of other files (${found.stamp.slice(0, 12)}), not of the ${found.buildId.slice(0, 12)} it holds; stamp it after its last build step`;
}

function notProduced(build: DeclaredBuild): string {
	return `build ${build.id} was not produced: setup left no files in ${build.directory}`;
}

export type { IdentifiedBuild, DeclaredBuild, BuiltIdentity } from './BuildIdentityService.types';
