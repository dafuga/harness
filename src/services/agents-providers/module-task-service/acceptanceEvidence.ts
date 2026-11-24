// @harness-uid u_mzypaxxnyu
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type { ModuleTask } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import {
	VerificationStoreRepository,
	type StoredRecord
} from '../../../repositories/verification-evidence/VerificationStoreRepository';
import { VerificationCheckService } from '../../verification-evidence/VerificationCheckService';
import type { EvidenceScope, TaskAcceptanceEvidence } from './acceptanceEvidence.types';
import { TaskAcceptanceEvidenceError } from './TaskAcceptanceEvidenceError';

/**
 * An accepted review must cite a commit that carries the submitted files unchanged and that a
 * stored, intact verification record proves: a full pass, or a pass scoped to this module only.
 * One full record of a commit that carries several submissions accepts each of them.
 */
export async function acceptanceEvidence(
	root: string,
	task: ModuleTask,
	revision: string
): Promise<TaskAcceptanceEvidence> {
	const git = new GitAdapter(root);
	const checkpoint = task.result?.checkpointCommit;
	if (!checkpoint)
		throw new TaskAcceptanceEvidenceError('The submission has no checkpoint commit to verify.');
	const commit = await resolveCommit(git, revision);
	const submitted = await git.run(['diff', '--name-only', '-z', task.sourceCommit, checkpoint]);
	await requireSubmission(git, checkpoint, commit, submitted.split('\0').filter(Boolean));
	const problems: string[] = [];
	for (const stored of recordsOf(root, commit)) {
		const found = await provenBy(root, commit, stored, task.module.id);
		if (typeof found !== 'string') return found;
		problems.push(`${stored.record.id.slice(0, 12)}: ${found}`);
	}
	throw new TaskAcceptanceEvidenceError(
		problems.length
			? `No verification record of ${commit} proves ${task.module.id}: ${problems.join('; ')}`
			: `No verification record exists for ${commit}; run harness verify run --commit ${commit} first.`
	);
}

async function resolveCommit(git: GitAdapter, revision: string): Promise<string> {
	try {
		return await git.run(['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`]);
	} catch {
		throw new TaskAcceptanceEvidenceError(
			`Evidence revision ${revision} is not a commit in this repository.`
		);
	}
}

async function requireSubmission(
	git: GitAdapter,
	checkpoint: string,
	commit: string,
	paths: string[]
): Promise<void> {
	if (!paths.length)
		throw new TaskAcceptanceEvidenceError(
			'The submission changes no file; nothing can be accepted.'
		);
	const [submitted, verified] = await Promise.all(
		[checkpoint, commit].map((revision) => blobs(git, revision, paths))
	);
	const differ = paths.filter((path) => submitted.get(path) !== verified.get(path));
	if (differ.length)
		throw new TaskAcceptanceEvidenceError(
			`Evidence commit ${commit} does not carry the submitted ${differ.join(', ')} unchanged.`
		);
}

async function blobs(git: GitAdapter, revision: string, paths: string[]) {
	const listed = await git.run(['ls-tree', '-z', '--full-tree', revision, '--', ...paths]);
	const found = new Map<string, string>();
	for (const entry of listed.split('\0').filter(Boolean)) {
		const [meta, path] = entry.split('\t');
		found.set(path, meta.split(' ')[2]);
	}
	return found;
}

function recordsOf(root: string, commit: string): StoredRecord[] {
	return new VerificationStoreRepository(root)
		.all()
		.filter((stored) => stored.record.source.commit === commit && !stored.record.lite)
		.sort((left, right) => (left.record.startedAt < right.record.startedAt ? 1 : -1));
}

async function provenBy(
	root: string,
	commit: string,
	stored: StoredRecord,
	module: string
): Promise<TaskAcceptanceEvidence | string> {
	const { record } = stored;
	const { scope, problem } = recordScope(record, module);
	if (!scope) return problem;
	// A full pass is checked as `verify check` does, lineage included; a scoped record inherits nothing.
	const checks = new VerificationCheckService(root);
	const problems =
		scope === 'full'
			? (await checks.check(commit, stored)).problems
			: await checks.integrity(commit, stored);
	if (problems.length) return problems.join(', ');
	return { commit, record: record.id, scope, checks: record.tests.length };
}

function recordScope(record: StoredRecord['record'], module: string): EvidenceScope {
	if (record.status === 'passed' && !record.failures.length) return { scope: 'full' };
	const scoped = record.failures.filter((failure) => failure.startsWith('Scoped to '));
	const others = record.failures.filter((failure) => !failure.startsWith('Scoped to '));
	if (others.length) return { problem: others.slice(0, 5).join(', ') };
	if (scoped.length !== 1 || !scoped[0].startsWith(`Scoped to ${module}:`))
		return { problem: `the record is not scoped to ${module}` };
	if (!record.tests.length) return { problem: 'the scoped record ran no check' };
	const failing = record.tests.filter((check) => check.status !== 'passed');
	if (failing.length)
		return { problem: `checks did not pass: ${failing.map((check) => check.id).join(', ')}` };
	return { scope: 'entity' };
}
