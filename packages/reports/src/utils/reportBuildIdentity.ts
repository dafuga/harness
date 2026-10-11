import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIdentity, builtFileHash } from '../../../../src/utils/buildIdentity';

const development = 'harness-reports-development';
const known = new Map<string, string>();

/** A compiled server is a directory with the adapter's handler beside its client files. */
function compiled(directory: string): boolean {
	return existsSync(join(directory, 'handler.js')) && existsSync(join(directory, 'client'));
}

/** The compiled server this code runs from, or undefined when it runs from source. */
function ownBuild(): string | undefined {
	let directory = dirname(fileURLToPath(import.meta.url));
	for (let depth = 0; depth < 6; depth += 1) {
		if (compiled(directory)) return directory;
		directory = dirname(directory);
	}
	return undefined;
}

function digest(directory: string): string {
	const entries = readdirSync(directory, { withFileTypes: true, recursive: true });
	const files = entries
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name))
		.map((path) => ({
			path: relative(directory, path).split(sep).join('/'),
			sha256: builtFileHash(readFileSync(path)).sha256
		}));
	return files.length > 0 ? buildIdentity(files) : development;
}

/**
 * The identity of a compiled report server: a digest of the files in its build directory, read
 * once. Without an argument it is the build this code runs from, so a server reports what it
 * really serves; a server running from source reports no build at all.
 */
export function reportBuildIdentity(directory: string | undefined = ownBuild()): string {
	if (!directory || !existsSync(directory)) return development;
	const found = known.get(directory) ?? digest(directory);
	known.set(directory, found);
	return found;
}
