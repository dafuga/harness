// @harness-uid u_64mql5f5ei
import type {
	PlannedFile,
	WriteFilesOptions,
	FileWriteResult,
	FileWriteStatus
} from '../../../core/development-tooling/files.types';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fail } from '../../../core/development-tooling/errors';

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

	return fail(`Refusing to overwrite ${path}. Re-run with --force to replace it.`);
}

function isMissingFile(error: unknown): boolean {
	return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
