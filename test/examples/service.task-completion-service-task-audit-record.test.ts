import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { taskAuditRecord } from '../../src/services/verification-evidence/task-completion-service/taskAuditRecord';

type Repository = { root: string; git: (...args: string[]) => string };

const unitId = 'service.task-completion-service-task-audit-record';
const commit = 'a31f7c5e09d2b84f16c3e7a0d95b2f48c6e1d30a';

const planningInput = {
	kind: 'planning' as const,
	goal: 'Plan retries for the webhook consumer',
	plan: 'docs/plans/webhook-retry.md',
	commit,
	checks: [
		{ id: 'source', passed: true, detail: `Committed source at ${commit}.` },
		{
			id: 'plan.overview',
			passed: true,
			detail: 'Provide a substantive overview section, including an explicit explanation when none applies.'
		}
	]
};

const codingInput = {
	kind: 'coding' as const,
	goal: 'Persist task audits under a content-addressed id',
	units: ['adapter.git', unitId, unitId],
	commit: null,
	checks: [{ id: 'evidence', passed: false, detail: 'Task evidence could not be read.' }]
};

function auditDirectory(repository: Repository): string {
	return repository.git('rev-parse', '--path-format=absolute', '--git-path', 'harness/task-audits').trim();
}

async function blockAuditDirectory(repository: Repository): Promise<void> {
	const directory = auditDirectory(repository);
	await mkdir(dirname(directory), { recursive: true });
	await writeFile(directory, 'a file where the audit directory should be');
}

test('Persists a planning and a coding audit under content-addressed ids', async () => {
	await withTempRepo(async (repository) => {
		const planning = await taskAuditRecord(repository.root, planningInput);
		const coding = await taskAuditRecord(repository.root, codingInput);
		const directory = auditDirectory(repository);
		const stored = JSON.parse(await readFile(join(directory, `${planning.id}.json`), 'utf8'));

		expect(planning.id).toMatch(/^[0-9a-f]{64}$/);
		expect(planning.passed).toBe(true);
		expect(planning.task).toEqual({ plan: 'docs/plans/webhook-retry.md', loop: null, units: [] });
		expect(stored).toEqual(planning);
		expect(coding.task.units).toEqual(['adapter.git', unitId]);
		expect(coding.passed).toBe(false);
		expect(coding.commit).toBeNull();
		expect(JSON.parse(await readFile(join(directory, `${coding.id}.json`), 'utf8'))).toEqual(coding);

		recordExampleCases(
			{
				unitId,
				symbol: 'taskAuditRecord',
				state: 'persists-a-planning-and-a-coding-audit-under-content-address',
				evidence: 'examples-cases',
				file: 'persists-a-planning-and-a-coding-audit-under-content-address.json'
			},
			[
				{
					name: 'planning audit with two passing checks is stored and passes',
					input: planningInput,
					output: { id: planning.id, passed: planning.passed, task: planning.task }
				},
				{
					name: 'coding audit with duplicate units is de-duplicated and fails on a failed check',
					input: codingInput,
					output: { id: coding.id, passed: coding.passed, task: coding.task }
				}
			]
		);
	});
});

test('Rejects when the audit directory path is blocked by a file', async () => {
	await withTempRepo(async (repository) => {
		await blockAuditDirectory(repository);
		let error: unknown;
		try {
			await taskAuditRecord(repository.root, codingInput);
		} catch (caught) {
			error = caught;
		}
		const code = (error as { code?: unknown } | undefined)?.code;

		expect(error).toBeInstanceOf(Error);
		expect(typeof code).toBe('string');

		recordExampleCases(
			{
				unitId,
				symbol: 'taskAuditRecord',
				state: 'rejects-when-the-audit-directory-path-is-blocked-by-a-file',
				evidence: 'examples-cases',
				file: 'rejects-when-the-audit-directory-path-is-blocked-by-a-file.json'
			},
			[
				{
					name: 'audit directory under a file rejects with a filesystem error and no audit is returned',
					input: codingInput,
					error: {
						name: (error as Error).name,
						code: code ?? null
					}
				}
			]
		);
	});
});
