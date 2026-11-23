import type { Repo } from './service.task-completion-service-source-audit.test.types';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import type { TaskAuditInput } from '../../src/services/verification-evidence/TaskCompletionService';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { sourceAudit } from '../../src/services/verification-evidence/task-completion-service/sourceAudit';
import { TaskCompletionSourceAuditError } from '../../src/services/verification-evidence/task-completion-service/sourceAudit.types';

const invalidTasks: Array<{ name: string; input: TaskAuditInput }> = [
	{
		name: 'unsupported kind',
		input: { kind: 'review' as 'coding', goal: 'Review the evidence grid' }
	},
	{ name: 'blank goal', input: { kind: 'coding', goal: '   ' } },
	{
		name: 'invalid loop name',
		input: { kind: 'coding', goal: 'Finish the evidence grid', loop: 'Evidence_Grid' }
	}
];

function commitFile(repo: Repo, name: string, content: string): void {
	writeFileSync(join(repo.root, name), content);
	repo.git('add', name);
	repo.git('commit', '-m', `add ${name}`);
}

async function failureOf(run: () => Promise<unknown>): Promise<unknown> {
	try {
		await run();
		return undefined;
	} catch (caught) {
		return caught;
	}
}

function summarise(error: unknown): { name: string; message: string } {
	return { name: (error as Error).name, message: (error as Error).message };
}

test('Returns the committed HEAD for a clean coding task', async () => {
	await withTempRepo(async (repo) => {
		commitFile(repo, 'grid.ts', 'export const grid = [];\n');
		const head = repo.git('rev-parse', 'HEAD').trim();
		const sha = await sourceAudit(repo.root, {
			kind: 'coding',
			goal: 'Add the evidence grid to the reports component'
		});

		expect(sha).toBe(head);
		expect(sha).toMatch(/^[0-9a-f]{40}$/);
		recordExampleCases(
			{
				unitId: 'service.task-completion-service-source-audit',
				symbol: 'sourceAudit',
				state: 'returns-the-committed-head-for-a-clean-coding-task',
				evidence: 'examples-cases',
				file: 'returns-the-committed-head-for-a-clean-coding-task.json'
			},
			[
				{
					name: 'clean repository with a committed coding goal',
					input: { kind: 'coding', goal: 'Add the evidence grid to the reports component' },
					output: { fullSha: /^[0-9a-f]{40}$/.test(sha), matchesHead: sha === head }
				}
			]
		);
	});
});

test('Rejects an uncommitted source change', async () => {
	await withTempRepo(async (repo) => {
		commitFile(repo, 'grid.ts', 'export const grid = [];\n');
		writeFileSync(join(repo.root, 'grid.ts'), 'export const grid = [1];\n');
		const input: TaskAuditInput = { kind: 'coding', goal: 'Add the evidence grid' };
		const error = await failureOf(() => sourceAudit(repo.root, input));

		expect(error).toBeInstanceOf(TaskCompletionSourceAuditError);
		expect((error as Error).message).toContain('Commit the task source');
		recordExampleCases(
			{
				unitId: 'service.task-completion-service-source-audit',
				symbol: 'sourceAudit',
				state: 'rejects-an-uncommitted-source-change',
				evidence: 'examples-cases',
				file: 'rejects-an-uncommitted-source-change.json'
			},
			[
				{
					name: 'tracked source file modified after the commit',
					input,
					error: summarise(error)
				}
			]
		);
	});
});

test('Rejects an invalid task declaration', async () => {
	await withTempDir('task-audit-invalid-', async (directory) => {
		const cases: Array<{ name: string; input: unknown; error: unknown }> = [];
		for (const { name, input } of invalidTasks) {
			const error = await failureOf(() => sourceAudit(directory, input));
			expect(error).toBeInstanceOf(TaskCompletionSourceAuditError);
			cases.push({ name, input, error: summarise(error) });
		}
		recordExampleCases(
			{
				unitId: 'service.task-completion-service-source-audit',
				symbol: 'sourceAudit',
				state: 'rejects-an-invalid-task-declaration',
				evidence: 'examples-cases',
				file: 'rejects-an-invalid-task-declaration.json'
			},
			cases
		);
	});
});
