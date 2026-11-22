// @harness-uid u_o7ubhvl4t2
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
/** Only result collections are traversed; worktrees, logs and dependencies remain unread. */
export function resultFiles(root: string): string[] {
	const files: string[] = [];
	const visit = (directory: string, depth: number): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isFile() && entry.name === 'result.json') files.push(path);
			if (entry.isDirectory() && depth < 4) visit(path, depth + 1);
		}
	};
	for (const entry of readdirSync(root, { withFileTypes: true }))
		if (entry.isDirectory() && entry.name.startsWith('results-')) visit(join(root, entry.name), 0);
	return files.sort();
}
