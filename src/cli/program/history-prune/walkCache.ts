// @harness-uid u_hprunwalke
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { WalkResult } from './previewHistory.types';

export async function scanCacheTree(path: string): Promise<WalkResult> {
	const state = await lstatOrError(path);
	return walkState(path, state, '');
}

async function walkState(
	path: string,
	state: Awaited<ReturnType<typeof lstat>> | Error | undefined,
	relativePath: string
): Promise<WalkResult> {
	if (state instanceof Error)
		return { files: [], reasons: [`cannot inspect entry: ${state.message}`] };
	if (!state) return { files: [], reasons: ['entry disappeared during inventory'] };
	if (state.isSymbolicLink()) return { files: [], reasons: ['symlink is not traversed'] };
	if (state.isFile()) return { bytes: Number(state.size), files: [relativePath], reasons: [] };
	if (!state.isDirectory())
		return { files: [], reasons: ['non-regular filesystem entry is protected'] };
	return scanDirectory(path, relativePath);
}

async function scanDirectory(path: string, relativePath: string): Promise<WalkResult> {
	const names = await readdir(path).catch(() => undefined);
	if (!names) return { bytes: 0, files: [], reasons: ['cannot list directory'] };
	const result: WalkResult = { bytes: 0, files: [], reasons: [] };
	for (const name of names) {
		const childPath = join(path, name);
		const childRelative = relativePath ? join(relativePath, name) : name;
		const state = await lstatOrError(childPath);
		const child = await walkState(childPath, state, childRelative);
		result.bytes! += child.bytes ?? 0;
		result.files.push(...child.files);
		result.reasons.push(...child.reasons.map((reason) => `${name}: ${reason}`));
	}
	return result;
}

function errorCode(error: unknown): string | undefined {
	return typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		typeof error.code === 'string'
		? error.code
		: undefined;
}

async function lstatOrError(path: string) {
	try {
		return await lstat(path);
	} catch (error) {
		return errorCode(error) === 'ENOENT' ? undefined : new Error(String(error));
	}
}
