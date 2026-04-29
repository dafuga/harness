import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fail } from './errors';

export interface PlannedFile {
	path: string;
	contents: string;
}

export type FileWriteStatus = 'created' | 'skipped' | 'overwritten';

export interface FileWriteResult extends PlannedFile {
	status: FileWriteStatus;
}

export interface WriteFilesOptions {
	force?: boolean;
}

export async function writePlannedFiles(
	root: string,
	files: PlannedFile[],
	options: WriteFilesOptions = {}
): Promise<FileWriteResult[]> {
	const results: FileWriteResult[] = [];

	for (const file of files) {
		const target = join(root, file.path);
		const existingContents = await readExistingFile(target);
		const status = fileStatus(file.path, file.contents, existingContents, options);

		if (status !== 'skipped') {
			await writeFile(target, file.contents);
		}

		results.push({ ...file, status });
	}

	return results;
}

export async function ensureParents(root: string, files: PlannedFile[]): Promise<void> {
	const dirs = new Set(files.map((file) => dirname(join(root, file.path))));
	for (const dir of dirs) {
		await mkdir(dir, { recursive: true });
	}
}

export function renderFileList(files: FileWriteResult[]): string {
	return files.map((file) => `  ${statusLabel(file.status)} ${file.path}`).join('\n');
}

async function readExistingFile(path: string): Promise<string | undefined> {
	try {
		return await readFile(path, 'utf8');
	} catch (error) {
		if (isMissingFile(error)) {
			return undefined;
		}

		throw error;
	}
}

function fileStatus(
	path: string,
	contents: string,
	existingContents: string | undefined,
	options: WriteFilesOptions
): FileWriteStatus {
	if (existingContents === undefined) {
		return 'created';
	}

	if (existingContents === contents) {
		return 'skipped';
	}

	if (options.force) {
		return 'overwritten';
	}

	fail(`Refusing to overwrite ${path}. Re-run with --force to replace it.`);
}

function isMissingFile(error: unknown): boolean {
	return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function statusLabel(status: FileWriteStatus): string {
	if (status === 'created') {
		return 'create';
	}

	if (status === 'overwritten') {
		return 'overwrite';
	}

	return 'skip';
}
