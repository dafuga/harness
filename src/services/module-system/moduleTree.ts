import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Read module metadata without scanning application source or importing project code. */
export function moduleTree(root: string) {
	return {
		read: (path: string) => readFile(join(root, path), 'utf8'),
		async list() {
			try {
				const directories = await readdir(join(root, 'specification/modules'), {
					withFileTypes: true
				});
				const names = directories.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
				const entries = await Promise.all(
					names.map(async (name) => {
						const path = `specification/modules/${name}/module.json`;
						try {
							await readFile(join(root, path), 'utf8');
							return { path };
						} catch (error) {
							if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
							throw error;
						}
					})
				);
				return entries.filter((entry): entry is { path: string } => entry !== undefined);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
				throw error;
			}
		}
	};
}
