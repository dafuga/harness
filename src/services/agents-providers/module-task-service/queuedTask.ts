import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type {
	ModuleTask,
	ModuleTaskInput,
	TaskFeature
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { stableJson } from '../../../utils/development-tooling/stableJson';
const verificationPath = /(^|\/)(test|tests)\/|\.(test|spec)\.[jt]sx?$/;
const hasControl = (value: string) =>
	Array.from(value).some((character) => {
		const code = character.charCodeAt(0);
		return code < 32 || (code >= 127 && code <= 159);
	});
function canonicalFile(file: string): boolean {
	const parts = file.split('/');
	return (
		file.length > 0 &&
		!file.startsWith('/') &&
		!/^[a-zA-Z]:/.test(file) &&
		!file.includes('\\') &&
		!hasControl(file) &&
		!/[*?]/.test(file) &&
		parts.every((part) => part && part !== '.' && part !== '..' && part.toLowerCase() !== '.git')
	);
}
function assertPaths(paths: string[], label: string) {
	if (paths.some((path) => !canonicalFile(path)))
		throw new Error(`${label} must contain canonical relative file paths.`);
	const exact = new Set(paths),
		folded = new Set(paths.map((path) => path.toLowerCase()));
	if (exact.size !== paths.length || folded.size !== paths.length)
		throw new Error(`${label} contains duplicate or case-aliased paths.`);
}
function ownedPatternMatches(file: string, pattern: string): boolean {
	if (pattern.endsWith('/')) return file.startsWith(pattern);
	let expression = '^';
	for (let index = 0; index < pattern.length; index++) {
		if (pattern.slice(index, index + 3) === '**/') {
			expression += '(?:.*/)?';
			index += 2;
		} else if (pattern.slice(index, index + 2) === '**') {
			expression += '.*';
			index++;
		} else if (pattern[index] === '*') expression += '[^/]*';
		else expression += pattern[index].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
	return new RegExp(`${expression}$`).test(file);
}
function assertVerificationFiles(files: string[]) {
	assertPaths(files, 'Verification grants');
	if (files.some((file) => !verificationPath.test(file)))
		throw new Error('Verification grants must name explicit test or verification files.');
}
function resolveTaskFiles(
	input: ModuleTaskInput,
	role: 'implementation' | 'verification',
	verification: string[],
	source: { owned: string[]; committedFiles: string[] }
): string[] {
	if (input.assignedFiles !== undefined) {
		assertPaths(input.assignedFiles, 'Assigned files');
		if (!input.assignedFiles.length) throw new Error('Assigned files must not be empty.');
		return input.assignedFiles;
	}
	if (role === 'verification') return verification;
	return [
		...new Set(
			source.owned.flatMap((pattern) =>
				source.committedFiles.filter(
					(file) => !verificationPath.test(file) && ownedPatternMatches(file, pattern)
				)
			)
		)
	];
}
function assertTaskFileGrant(
	file: string,
	role: 'implementation' | 'verification',
	scope: { allowed: string[]; committed: Set<string>; committedFiles: string[] }
) {
	const isAllowed =
		role === 'verification'
			? scope.allowed.includes(file)
			: !verificationPath.test(file) &&
				scope.allowed.some((pattern) => ownedPatternMatches(file, pattern));
	if (!isAllowed)
		throw new Error(
			role === 'verification'
				? 'Verification tasks may use only explicitly declared verification files.'
				: 'Implementation tasks may use only committed module-owned source files.'
		);
	if (scope.committed.has(file)) return;
	if (scope.committedFiles.some((candidate) => candidate.toLowerCase() === file.toLowerCase()))
		throw new Error('Assigned files must use the exact case from the selected source revision.');
	throw new Error('Assigned files must exist in the selected committed source revision.');
}
export async function taskGrantFiles(
	input: ModuleTaskInput,
	unit: ComponentManifest,
	tree: CommitTreeAdapter
): Promise<string[]> {
	const role = input.role ?? 'implementation';
	const verification = input.verificationFiles ?? [],
		owned = unit.owns.source;
	const committedFiles = (await tree.list()).map((entry) => entry.path);
	assertVerificationFiles(verification);
	const allowed = role === 'verification' ? verification : owned;
	const files = resolveTaskFiles(input, role, verification, { owned, committedFiles });
	if (!files.length) throw new Error(`A ${role} task requires an explicit nonempty file grant.`);
	assertPaths(files, 'Resolved file grant');
	const committed = new Set(committedFiles);
	for (const file of files) assertTaskFileGrant(file, role, { allowed, committed, committedFiles });
	return [...files];
}
export async function validateTaskGrant(root: string, files: string[]): Promise<void> {
	const resolvedRoot = await realpath(root);
	await Promise.all(files.map((file) => validateWorkingFile(resolvedRoot, file)));
}
function unsafeEntry(entry: Awaited<ReturnType<typeof lstat>>, parent: boolean) {
	return (
		entry.isSymbolicLink() || (parent ? !entry.isDirectory() : !entry.isFile() || entry.nlink !== 1)
	);
}
async function validateWorkingFile(root: string, file: string): Promise<void> {
	let current = root;
	const parts = file.split('/');
	for (const [index, part] of parts.entries()) {
		try {
			if (!(await readdir(current)).includes(part)) throw new Error();
			current = resolve(current, part);
			const entry = await lstat(current);
			if (unsafeEntry(entry, index < parts.length - 1)) throw new Error();
		} catch {
			throw new Error(
				'Assigned files must be regular files without symlinks, hard links or symlink parents.'
			);
		}
	}
	const handle = await open(current, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
	try {
		const entry = await handle.stat();
		if (!entry.isFile() || entry.nlink !== 1)
			throw new Error('Assigned files must be regular files without symlinks or hard links.');
	} finally {
		await handle.close();
	}
}
export function queuedTask(
	input: ModuleTaskInput,
	feature: TaskFeature,
	unit: ComponentManifest,
	...selection: [sourceCommit: string, files?: string[]]
): ModuleTask {
	const [
		sourceCommit,
		files = input.assignedFiles ??
			(input.role === 'verification' ? (input.verificationFiles ?? []) : unit.owns.source)
	] = selection;
	return {
		...input,
		feature,
		module: {
			id: unit.id,
			goal: input.moduleGoal ?? unit.responsibility,
			files: [...files]
		},
		sourceCommit,
		contractHash: createHash('sha256').update(stableJson(input.wantedContract)).digest('hex'),
		status: 'queued',
		createdAt: new Date().toISOString(),
		attempts: [],
		reviews: [],
		claimHistory: []
	};
}
