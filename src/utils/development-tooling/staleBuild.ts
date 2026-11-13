// @harness-uid u_fp6usylruz
import { basename, dirname, join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

/** A checkout-only warning: installed packages without source need no comparison. */
export function staleBuild(entry: string): string | undefined {
	if (basename(dirname(entry)) !== 'dist') return undefined;
	try {
		const root = dirname(dirname(entry));
		const builtAt = statSync(entry).mtimeMs;
		if (['src', 'crates'].some((path) => newerSource(join(root, path), builtAt)))
			return 'Warning: this dist build is older than source; run bun run build:cli before using it.';
	} catch {
		/* A packaged installation may not include checkout sources. */
	}
	return undefined;
}
function newerSource(directory: string, builtAt: number): boolean {
	try {
		return readdirSync(directory, { withFileTypes: true }).some((entry) => {
			const path = join(directory, entry.name);
			return entry.isDirectory()
				? newerSource(path, builtAt)
				: entry.isFile() && statSync(path).mtimeMs > builtAt;
		});
	} catch {
		return false;
	}
}
