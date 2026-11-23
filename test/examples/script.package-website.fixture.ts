import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The files under a folder of the project, as paths from the project root, sorted. */
function filesUnder(root: string, folder: string): string[] {
	const base = join(root, folder);
	if (!existsSync(base)) return [];
	return readdirSync(base, { encoding: 'utf8', recursive: true })
		.filter((entry) => statSync(join(base, entry)).isFile())
		.map((entry) => `${folder}/${entry}`)
		.sort();
}

/** The text of a file of the project, or null when the script did not write it. */
function textOf(root: string, path: string): string | null {
	const file = join(root, path);
	return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/** What a run left in the project folder: the files under dist and the outputs the script writes. */
export function leftBehind(root: string) {
	return {
		distFiles: filesUnder(root, 'dist'),
		cli: textOf(root, 'dist/reports/cli.js'),
		consoleUi: textOf(root, 'dist/api/console-ui.js'),
		declaration: textOf(root, 'dist/types/lib/console-ui.d.ts')
	};
}
