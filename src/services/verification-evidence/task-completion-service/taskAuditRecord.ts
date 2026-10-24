import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type { TaskAudit, TaskAuditInput } from '../TaskCompletionService';
import type { TaskCheck } from './planAudit';

export async function taskAuditRecord(
	root: string,
	input: TaskAuditInput & { commit: string | null; checks: TaskCheck[] }
): Promise<TaskAudit> {
	const body = {
		schemaVersion: 1 as const,
		commit: input.commit,
		kind: input.kind,
		goal: input.goal,
		task: {
			plan: input.plan ?? null,
			loop: input.loop ?? null,
			units: [...new Set(input.units ?? [])].sort()
		},
		passed: input.checks.length > 0 && input.checks.every((check) => check.passed),
		checks: input.checks,
		limitation:
			'Structural and evidence heuristics cannot prove arbitrary semantic correctness; review acceptance criteria and remaining uncertainty.'
	};
	const id = createHash('sha256').update(JSON.stringify(body)).digest('hex');
	const gitPath = await new GitAdapter(root)
		.attempt(['rev-parse', '--path-format=absolute', '--git-path', 'harness/task-audits'])
		.catch(() => undefined);
	const directory = gitPath
		? resolve(root, gitPath)
		: join(
				tmpdir(),
				'harness-task-audits',
				createHash('sha256').update(resolve(root)).digest('hex')
			);
	await mkdir(directory, { recursive: true });
	const audit = { ...body, id };
	await writeFile(join(directory, `${id}.json`), `${JSON.stringify(audit, null, '\t')}\n`);
	return audit;
}
