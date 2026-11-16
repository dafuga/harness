import { chmodSync, mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ProjectRegistryService } from '../../src/services/projects-sessions/ProjectRegistryService';

const directories: string[] = [];

function temporaryDirectory(prefix: string) {
	const directory = mkdtempSync(join(tmpdir(), `${prefix}-`));
	directories.push(directory);
	return directory;
}

function cleanup() {
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
	vi.unstubAllEnvs();
}

function project(root: string) {
	return { id: `local-${'a'.repeat(64)}`, name: 'project', kind: 'local', root };
}

function registeredProject(directory: string) {
	const root = realpathSync(directory);
	return {
		id: `local-${createHash('sha256').update(root).digest('hex')}`,
		name: root.split('/').at(-1),
		kind: 'local',
		root
	};
}

afterEach(cleanup);

test('Registers a canonical local project and reuses it', async () => {
	const root = temporaryDirectory('project-registry-root');
	const bin = temporaryDirectory('project-registry-bin');
	const git = join(bin, 'git');
	writeFileSync(git, '#!/bin/sh\nprintf "%s\\n" "$2"\n');
	chmodSync(git, 0o755);
	vi.stubEnv('PATH', bin);
	const registry = new ProjectRegistryService(join(temporaryDirectory('project-registry-data'), 'projects.json'));
	const first = await registry.register(root);
	const second = await registry.register(root);
	const expected = registeredProject(root);
	expect(first).toEqual(expected);
	expect(second).toEqual(expected);
	recordExampleCases(
		{
			unitId: 'desktop.service.project-registry',
			symbol: 'register',
			state: 'registers-a-canonical-local-project-and-reuses-it',
			evidence: 'examples-cases',
			file: 'registers-a-canonical-local-project-and-reuses-it.json'
		},
		[
			{
				name: 'Registering a Git root creates its local record and repeated registration returns it',
				input: { directory: root, file: 'temporary projects.json' },
				output: { first, second }
			}
		]
	);
});

test('Lists valid projects and rejects an invalid registry', async () => {
	const directory = temporaryDirectory('project-registry-list');
	const file = join(directory, 'projects.json');
	const valid = project('/workspace/project');
	writeFileSync(file, JSON.stringify([valid]));
	const listed = await new ProjectRegistryService(file).list();
	expect(listed).toEqual([valid]);
	writeFileSync(file, JSON.stringify([{ ...valid, id: 'bad-id' }]));
	let failure: unknown;
	try {
		await new ProjectRegistryService(file).list();
	} catch (error) {
		failure = error instanceof Error ? { name: error.name, message: error.message } : String(error);
	}
	expect(failure).toEqual({ name: 'InvalidProjectRegistryError', message: 'Invalid project registry.' });
	recordExampleCases(
		{
			unitId: 'desktop.service.project-registry',
			symbol: 'list',
			state: 'lists-valid-projects-and-rejects-an-invalid-registry',
			evidence: 'examples-cases',
			file: 'lists-valid-projects-and-rejects-an-invalid-registry.json'
		},
		[
			{ name: 'A valid persisted project array is returned', input: { file, contents: [valid] }, output: listed },
			{
				name: 'An invalid project id rejects the persisted array',
				input: { file, contents: [{ ...valid, id: 'bad-id' }] },
				error: { name: 'InvalidProjectRegistryError', message: 'Invalid project registry.' }
			}
		]
	);
});

test('Gets a project by id and rejects an unknown id', async () => {
	const file = join(temporaryDirectory('project-registry-get'), 'projects.json');
	const known = project('/workspace/project');
	mkdirSync(join(file, '..'), { recursive: true });
	writeFileSync(file, JSON.stringify([known]));
	const registry = new ProjectRegistryService(file);
	const found = await registry.get(known.id);
	let failure: unknown;
	try {
		await registry.get(`local-${'b'.repeat(64)}`);
	} catch (error) {
		failure = error instanceof Error ? { name: error.name, message: error.message } : String(error);
	}
	expect(found).toEqual(known);
	expect(failure).toEqual({ name: 'UnknownProjectError', message: 'Unknown project.' });
	recordExampleCases(
		{
			unitId: 'desktop.service.project-registry',
			symbol: 'get',
			state: 'gets-a-project-by-id-and-rejects-an-unknown-id',
			evidence: 'examples-cases',
			file: 'gets-a-project-by-id-and-rejects-an-unknown-id.json'
		},
		[
			{ name: 'A matching id returns its persisted project', input: { id: known.id }, output: found },
			{
				name: 'An unknown id rejects with the declared error',
				input: { id: `local-${'b'.repeat(64)}` },
				error: { name: 'UnknownProjectError', message: 'Unknown project.' }
			}
		]
	);
});
