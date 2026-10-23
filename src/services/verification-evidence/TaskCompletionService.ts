import { posix } from 'node:path';
import { CommitTreeAdapter } from '../../adapters/git-source-history/CommitTreeAdapter';
import { planAudit, type TaskCheck } from './task-completion-service/planAudit';
import { sourceAudit } from './task-completion-service/sourceAudit';
import { taskAuditRecord } from './task-completion-service/taskAuditRecord';
import type { TaskAudit, TaskAuditInput } from './TaskCompletionService.types';
export type { TaskAudit, TaskAuditInput } from './TaskCompletionService.types';

/** Inspects actual source and Harness evidence; never promotes an agent's assertion to proof. */
export class TaskCompletionService {
	constructor(private readonly root: string) {}
	async check(input: TaskAuditInput): Promise<TaskAudit> {
		const checks: TaskCheck[] = [];
		let commit: string | null = null;
		try {
			commit = await sourceAudit(this.root, input);
			checks.push({ id: 'source', passed: true, detail: `Committed source at ${commit}.` });
			if (input.plan || input.kind === 'planning')
				checks.push(...planAudit(await this.proposal(commit, input.plan), input.goal));
			if (input.kind === 'coding') {
				const { codeAudit } = await import('./task-completion-service/codeAudit');
				checks.push(...(await codeAudit(this.root, commit, input.units)));
			}
			if ((await sourceAudit(this.root, input)) !== commit)
				throw new Error('Task source changed during its completion audit.');
		} catch (error) {
			checks.push({
				id: 'evidence',
				passed: false,
				detail: error instanceof Error ? error.message : 'Task evidence could not be read.'
			});
		}
		return taskAuditRecord(this.root, { ...input, commit, checks });
	}
	/** Content-only audit; check() also verifies the committed source around it. */
	requirePlan(proposal: string, goal: string): void {
		const missing = planAudit(proposal, goal).filter((check) => !check.passed);
		if (missing.length)
			throw new Error(
				`Task completion audit failed: ${missing.map((check) => check.detail).join(' ')}`
			);
	}
	async require(input: TaskAuditInput): Promise<TaskAudit> {
		const audit = await this.check(input);
		if (!audit.passed)
			throw new Error(
				`Task completion audit failed: ${audit.checks
					.filter((check) => !check.passed)
					.map((check) => check.detail)
					.join('\n')}`
			);
		return audit;
	}
	private async proposal(commit: string, path?: string): Promise<string> {
		if (!path || path.startsWith('/') || posix.normalize(path) !== path || path.startsWith('../'))
			throw new Error(
				'Name a committed project-relative --plan artifact for the completion audit.'
			);
		return (await CommitTreeAdapter.open(this.root, commit)).read(path);
	}
}

/** Guidance names the enforced systems and keeps planning separate from implementation. */
export function taskCompletionInstructions(): string[] {
	return [
		'Coding tasks require actual representative latency and memory profiling through Harness, independently of budget declarations. Use PerformanceProfileService in standardized tests or harness budget bench with a declared workload; label whole-process memory honestly.',
		'Commit the task source, run harness verify run --require-performance, then harness task check --loop <loop>. Missing, failed or stale evidence blocks completion; an agent reply or a free-text step claim is not verification.',
		'Planning tasks remain planning-only: include substantive Overview, Acceptance Criteria, Dependencies, Verification and Performance sections, with representative workloads, latency and memory measurement plans. Run the Harness task audit; do not fabricate runtime results or implement the plan.',
		'The final audit checks structural and evidence heuristics, not arbitrary semantic correctness. Expose remaining uncertainty and obtain required acceptance review. Do not change source after auditing it or claim completion while the audit fails.'
	];
}
