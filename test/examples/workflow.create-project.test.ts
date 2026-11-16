import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { createProject, renderCreateProject } from '../../src/cli/program/create-project/createProject';
import type { CreateProjectInput, CreateProjectResult } from '../../src/cli/program/create-project/createProject.types';

function stateId(title: string): string {
	return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function summarize(result: CreateProjectResult): object {
	return {
		kind: result.kind,
		name: result.name,
		writeCount: result.writes.length,
		statuses: result.writes.map((write) => write.status)
	};
}

test('Creates a project from a valid template input', async () => {
	const title = 'Creates a project from a valid template input';
	const state = stateId(title);
	await withTempDir('create-project-', async (directory) => {
		const input: CreateProjectInput = {
			kind: 'app',
			name: 'ledger-console',
			force: true,
			parent: directory,
			dimension: '3d'
		};
		const result = await createProject(input);
		expect(result.kind).toBe('app');
		expect(result.name).toBe('ledger-console');
		expect(result.writes.length).toBeGreaterThan(0);
		recordExampleCases(
			{ unitId: 'workflow.create-project', symbol: 'createProject', state, evidence: 'examples-cases', file: `${state}.json` },
			[{ name: 'creates the named app under the supplied parent with ordered writes', input, output: summarize(result) }]
		);
	});
});

test('Rejects an unsupported project dimension', async () => {
	const title = 'Rejects an unsupported project dimension';
	const state = stateId(title);
	const input = { kind: 'app', name: 'ledger-console', dimension: '4d' };
	let error: unknown;
	try {
		await createProject(input as CreateProjectInput);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).toBe('Dimension must be 2d or 3d.');
	recordExampleCases(
		{ unitId: 'workflow.create-project', symbol: 'createProject', state, evidence: 'examples-cases', file: `${state}.json` },
		[{ name: 'rejects before creating project files', input, error: { name: (error as Error).name, message: (error as Error).message } }]
	);
});

test('Renders a project creation result', () => {
	const title = 'Renders a project creation result';
	const state = stateId(title);
	const input: CreateProjectResult = { kind: 'app', name: 'ledger-console', writes: [] };
	const output = renderCreateProject(input);
	expect(output).toBe('Created app harness "ledger-console".\n');
	recordExampleCases(
		{ unitId: 'workflow.create-project', symbol: 'renderCreateProject', state, evidence: 'examples-cases', file: `${state}.json` },
		[{ name: 'renders the heading and empty file list', input, output }]
	);
});
