import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ModuleDataService } from '../../services/git-source-history/ModuleDataService';
import type {
	ModuleTaskDependencyBaseAdapterConfig,
	ModuleTaskDependencyBaseDependencies,
	ModuleTaskDependencyBaseInput
} from './ModuleTaskDependencyBaseAdapter.types';

const execute = promisify(execFile);
async function git(root: string, args: string[], env: NodeJS.ProcessEnv = {}) {
	const environment = { ...process.env };
	for (const key of [
		'GIT_DIR',
		'GIT_COMMON_DIR',
		'GIT_WORK_TREE',
		'GIT_INDEX_FILE',
		'GIT_OBJECT_DIRECTORY',
		'GIT_ALTERNATE_OBJECT_DIRECTORIES'
	])
		delete environment[key];
	const result = await execute('git', ['-C', root, ...args], {
		env: { ...environment, ...env },
		maxBuffer: 16 * 1024 * 1024
	});
	return result.stdout.trim();
}
async function validateMetadata(root: string, commit: string) {
	const service = new ModuleDataService(root);
	const report = await service.validate({ commit, write: true });
	if (!report.valid || !report.committed)
		throw new Error('Dependency base metadata is inadmissible.');
	await service.require(commit);
}
async function checkedCommits(root: string, input: ModuleTaskDependencyBaseInput) {
	const format = await git(root, ['rev-parse', '--show-object-format']);
	let size = 0;
	if (format === 'sha1') size = 40;
	if (format === 'sha256') size = 64;
	if (!size) throw new Error('Unsupported repository object format.');
	const checkpoints = [...new Set(input.checkpoints)].sort();
	for (const commit of [input.sourceCommit, ...checkpoints]) {
		if (typeof commit !== 'string' || commit.length !== size || !/^[0-9a-f]+$/.test(commit))
			throw new Error('Dependency revisions must be full immutable commit IDs.');
		if ((await git(root, ['cat-file', '-t', commit])) !== 'commit')
			throw new Error('Dependency revision is not a commit.');
		await git(root, ['merge-base', '--is-ancestor', input.sourceCommit, commit]);
	}
	return checkpoints;
}
async function mergePair(root: string, left: string, right: string, index: string) {
	const bases = (await git(root, ['merge-base', '--all', left, right])).split('\n');
	if (bases.length !== 1 || !bases[0]) throw new Error('Dependency merge base is ambiguous.');
	if (bases[0] === left) return right;
	if (bases[0] === right) return left;
	const env = { GIT_INDEX_FILE: index };
	await git(root, ['read-tree', '-i', '-m', bases[0], left, right], env);
	if (await git(root, ['ls-files', '--unmerged'], env))
		throw new Error('Dependency checkpoints conflict.');
	const tree = await git(root, ['write-tree'], env);
	return git(
		root,
		[
			'-c',
			'commit.gpgsign=false',
			'commit-tree',
			tree,
			'-p',
			left,
			'-p',
			right,
			'-m',
			'chore: compose accepted task checkpoints'
		],
		{
			...env,
			GIT_AUTHOR_NAME: 'Harness',
			GIT_AUTHOR_EMAIL: 'harness@example.invalid',
			GIT_COMMITTER_NAME: 'Harness',
			GIT_COMMITTER_EMAIL: 'harness@example.invalid',
			GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
			GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z'
		}
	);
}
async function compose(root: string, source: string, checkpoints: string[]) {
	if (checkpoints.length < 2) return checkpoints[0] ?? source;
	const directory = await mkdtemp(join(tmpdir(), 'harness-task-base-'));
	try {
		let result = checkpoints[0];
		for (const checkpoint of checkpoints.slice(1)) {
			await rm(join(directory, 'index'), { force: true });
			result = await mergePair(root, result, checkpoint, join(directory, 'index'));
		}
		return result;
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

export class ModuleTaskDependencyBaseAdapter {
	private readonly root: string;
	private readonly config: ModuleTaskDependencyBaseAdapterConfig;
	constructor(
		root: string | ModuleTaskDependencyBaseAdapterConfig = process.cwd(),
		private readonly dependencies: ModuleTaskDependencyBaseDependencies = {}
	) {
		this.root = typeof root === 'string' ? root : process.cwd();
		this.config = typeof root === 'string' ? {} : root;
	}
	connect(): string {
		return this.config.name ?? 'module-task-dependency-base';
	}
	async resolve(input: ModuleTaskDependencyBaseInput): Promise<string> {
		if (!input || !Array.isArray(input.checkpoints))
			throw new Error('Invalid dependency revisions.');
		const checkpoints = await checkedCommits(this.root, input);
		const result = await compose(this.root, input.sourceCommit, checkpoints);
		await (this.dependencies.validateMetadata ?? validateMetadata)(this.root, result);
		if (result !== input.sourceCommit && !checkpoints.includes(result)) {
			await git(this.root, ['update-ref', `refs/harness/task-bases/${result}`, result]);
		}
		return result;
	}
}

export type {
	ModuleTaskDependencyBaseAdapterConfig,
	ModuleTaskDependencyBaseDependencies,
	ModuleTaskDependencyBaseInput
} from './ModuleTaskDependencyBaseAdapter.types';
