import { dirname, join } from 'node:path';

export interface PlannedFile {
	path: string;
	contents: string;
}

export async function writePlannedFiles(root: string, files: PlannedFile[]): Promise<void> {
	for (const file of files) {
		const target = join(root, file.path);
		await Bun.write(target, file.contents);
	}
}

export async function ensureParents(root: string, files: PlannedFile[]): Promise<void> {
	const dirs = new Set(files.map((file) => dirname(join(root, file.path))));
	for (const dir of dirs) {
		await Bun.$`mkdir -p ${dir}`.quiet();
	}
}

export function renderFileList(files: PlannedFile[]): string {
	return files.map((file) => `  create ${file.path}`).join('\n');
}
