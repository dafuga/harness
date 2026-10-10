import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { buildIdentity, type BuiltFile } from '../utils/buildIdentity';

export interface IdentifiedBuild {
	buildId: string;
	/** Number of files the identity covers. */
	files: number;
}

export interface DeclaredBuild {
	id: string;
	directory: string;
}

export type BuiltIdentity = DeclaredBuild & IdentifiedBuild;

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
			if (identified) found.push({ ...build, ...identified });
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

	/** Undefined when the directory is missing or holds no file: nothing was built there. */
	async identify(directory: string): Promise<IdentifiedBuild | undefined> {
		const files = await this.files(directory);
		return files.length > 0 ? { buildId: buildIdentity(files), files: files.length } : undefined;
	}

	private async files(directory: string): Promise<BuiltFile[]> {
		const entries = await readdir(directory, { withFileTypes: true, recursive: true }).catch(
			() => []
		);
		const paths = entries
			.filter((entry) => entry.isFile())
			.map((entry) => join(entry.parentPath, entry.name));
		return Promise.all(
			paths.map(async (path) => ({
				path: relative(directory, path).split(sep).join('/'),
				sha256: createHash('sha256')
					.update(await readFile(path))
					.digest('hex')
			}))
		);
	}
}

function notProduced(build: DeclaredBuild): string {
	return `build ${build.id} was not produced: setup left no files in ${build.directory}`;
}
