import type { Input } from './workflow.loop-state-new-loop-state.test.types';
import { test } from 'vitest';
import { newLoopState } from '../../src/cli/program/manage-loop/newLoopState';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';
import { withTempDir } from '../support/temporary';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const inputs: Input[] = [
	{
		name: 'fix-login-redirect',
		goal: 'Stop the login page from redirecting back to itself after sign-in.',
		createdAt: '2026-11-15T08:05:00.000Z'
	},
	{
		name: 'csv-export-plan',
		goal: 'Plan a CSV export for the orders report.',
		createdAt: '2026-11-15T10:12:45.318Z',
		kind: 'planning',
		plan: 'src/services/csv-export/plan.json'
	},
	{
		name: 'fix-checkout-totals',
		goal: 'Correct the tax rounding in the checkout summary.',
		createdAt: '2026-11-15T09:30:00.000Z',
		kind: 'coding'
	}
];

async function buildCases() {
	const cases = [];
	for (const input of inputs) {
		const state = await newLoopState('/workspace/acme-api', input);
		cases.push({
			name: input.name,
			input,
			output: {
				name: state.name,
				goal: state.goal,
				createdAt: state.createdAt,
				updatedAt: state.updatedAt,
				...(state.completion ? { completion: state.completion } : {}),
				steps: state.steps
			}
		});
	}
	return cases;
}

test('Adds completion only when a task kind is requested', async () => {
	const cases = await buildCases();
	expect(cases[0]?.output).toMatchObject({
		name: 'fix-login-redirect',
		updatedAt: inputs[0].createdAt,
		steps: []
	});
	expect(cases[0]?.output).not.toHaveProperty('completion');
	expect(cases[1]?.output).toMatchObject({
		completion: { version: 1, kind: 'planning', plan: 'src/services/csv-export/plan.json' }
	});
	expect(cases[2]?.output).toMatchObject({ completion: { version: 1, kind: 'coding' } });
	recordExampleCases(
		{
			unitId: 'workflow.loop-state-new-loop-state',
			symbol: 'newLoopState',
			state: 'adds-completion-only-when-a-task-kind-is-requested',
			evidence: 'examples-cases',
			file: 'adds-completion-only-when-a-task-kind-is-requested.json'
		},
		cases
	);
});

async function withTemplate(contents: string, use: (directory: string) => Promise<void>) {
	await withTempDir('new-loop-state-', async (directory) => {
		const templates = join(directory, 'specification', 'loop-templates');
		await mkdir(templates, { recursive: true });
		await writeFile(join(templates, 'custom.json'), contents);
		await use(directory);
	});
}

test('Throws ExpectedCliError when task kind is invalid', async () => {
	const input = { name: 'bad-kind', goal: 'Exercise invalid kind.', createdAt: '2026-11-15T12:00:00.000Z', kind: 'review' } as unknown as Parameters<typeof newLoopState>[1];
	await expect(newLoopState('/workspace/acme-api', input)).rejects.toMatchObject({ name: 'ExpectedCliError' });
	const cases = [{ name: 'invalid kind', input, error: { name: 'ExpectedCliError', message: 'Task kind must be coding or planning.' } }];
	recordExampleCases({ unitId: 'workflow.loop-state-new-loop-state', symbol: 'newLoopState', state: 'throws-expectedclierror-when-task-kind-is-invalid', evidence: 'examples-cases', file: 'throws-expectedclierror-when-task-kind-is-invalid.json' }, cases);
});

test('Throws SyntaxError when project template JSON is malformed', async () => {
	const input = { name: 'bad-json', goal: 'Exercise malformed template JSON.', createdAt: '2026-11-15T12:00:00.000Z', from: 'custom' };
	await withTemplate('{', async (root) => {
		await expect(newLoopState(root, input)).rejects.toBeInstanceOf(SyntaxError);
		const cases = [{ name: 'malformed template JSON', input, error: { name: 'SyntaxError' } }];
		recordExampleCases({ unitId: 'workflow.loop-state-new-loop-state', symbol: 'newLoopState', state: 'throws-syntaxerror-when-project-template-json-is-malformed', evidence: 'examples-cases', file: 'throws-syntaxerror-when-project-template-json-is-malformed.json' }, cases);
	});
});

test('Throws TypeError when project template steps have the wrong type', async () => {
	const input = { name: 'bad-steps', goal: 'Exercise invalid template steps.', createdAt: '2026-11-15T12:00:00.000Z', from: 'custom' };
	await withTemplate('{"id":"custom","title":"Custom","steps":{}}', async (root) => {
		await expect(newLoopState(root, input)).rejects.toBeInstanceOf(TypeError);
		const cases = [{ name: 'non-array steps', input, error: { name: 'TypeError' } }];
		recordExampleCases({ unitId: 'workflow.loop-state-new-loop-state', symbol: 'newLoopState', state: 'throws-typeerror-when-project-template-steps-have-the-wrong', evidence: 'examples-cases', file: 'throws-typeerror-when-project-template-steps-have-the-wrong.json' }, cases);
	});
});

test('Throws Error when project template directory is a file', async () => {
	await withTempDir('new-loop-state-file-', async (root) => {
		await mkdir(join(root, 'specification'), { recursive: true });
		await writeFile(join(root, 'specification', 'loop-templates'), 'not a directory');
		const input = { name: 'blocked-template', goal: 'Exercise filesystem failure.', createdAt: '2026-11-15T12:00:00.000Z', from: 'bug-fix' };
		await expect(newLoopState(root, input)).rejects.toBeInstanceOf(Error);
		const cases = [{ name: 'template path is a file', input, error: { name: 'Error', code: 'ENOTDIR' } }];
		recordExampleCases({ unitId: 'workflow.loop-state-new-loop-state', symbol: 'newLoopState', state: 'throws-error-when-project-template-directory-is-a-file', evidence: 'examples-cases', file: 'throws-error-when-project-template-directory-is-a-file.json' }, cases);
	});
});
