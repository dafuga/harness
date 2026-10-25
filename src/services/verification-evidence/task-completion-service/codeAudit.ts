import { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import { VerificationStoreRepository } from '../../../repositories/verification-evidence/VerificationStoreRepository';
import type { TaskCheck } from './planAudit';

export async function codeAudit(
	root: string,
	commit: string,
	requested: string[] = []
): Promise<TaskCheck[]> {
	const stored = new VerificationStoreRepository(root).latest(commit);
	if (!stored)
		throw new Error('Run harness verify run; no verification record proves the task commit.');
	// A missing record needs no compiler or framework dependency, including in the packed SDK.
	const [
		{ VerificationCheckService },
		{ loadSide },
		{ SourceIndexService },
		{ PerformanceEvidenceValidator }
	] = await Promise.all([
		import('../VerificationCheckService'),
		import('../../../workflows/development-tooling/loadRevisions'),
		import('../../development-tooling/source-index-service/SourceIndexService'),
		import('../../../validators/verification-evidence/PerformanceEvidenceValidator')
	]);
	const verified = await new VerificationCheckService(root).check(commit, stored);
	if (verified.status !== 'passed' || stored.record.status !== 'passed')
		throw new Error(`Harness verification failed: ${verified.problems.join('; ')}`);
	const side = await loadSide(
		root,
		await CommitTreeAdapter.open(root, commit),
		new SourceIndexService()
	);
	const { direct, added, indirect } = stored.record.impact.units;
	const ids = new Set([...direct, ...added, ...indirect, ...requested]);
	const units = side.manifests.filter((unit) => ids.has(unit.id));
	const missing = requested.filter((id) => !units.some((unit) => unit.id === id));
	const validator = new PerformanceEvidenceValidator();
	const required = validator.required(units, side.index.files);
	const problems = validator.validate({
		units,
		files: side.index.files,
		measurements: stored.record.measurements,
		commit,
		profile: stored.record.profile.id
	});
	if (required.length && !stored.record.tests.some((test) => test.status === 'passed'))
		problems.push('Run relevant automated tests for executable task units.');
	return auditChecks(stored.record.id, missing, required.length, problems);
}

function auditChecks(
	record: string,
	missing: string[],
	required: number,
	problems: string[]
): TaskCheck[] {
	return [
		{
			id: 'verification',
			passed: true,
			detail: `Intact record ${record} proves this commit.`
		},
		{
			id: 'scope',
			passed: missing.length === 0,
			detail: missing.length
				? `Unknown task units: ${missing.join(', ')}`
				: 'All declared units exist at this revision.'
		},
		{
			id: 'performance',
			passed: problems.length === 0,
			detail:
				problems.join('\n') ||
				(required
					? 'Current representative latency and memory profiles are recorded.'
					: 'No affected executable units; runtime profiling is inapplicable to this source change.')
		}
	];
}
