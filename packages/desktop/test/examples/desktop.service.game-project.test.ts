import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GameProjectAlreadyExistsError } from '../../src/lib/development-tooling/desktop-bridge/GameProjectAlreadyExistsError';
import { GameProjectBusyError } from '../../src/lib/development-tooling/desktop-bridge/GameProjectBusyError';
import { GameProjectService } from '../../src/lib/development-tooling/desktop-bridge/GameProjectService';

const roots: string[] = [];

function temporaryRoot() {
	const root = mkdtempSync(join(tmpdir(), 'game-project-example-'));
	roots.push(root);
	return root;
}

function makeSession(overrides: Record<string, unknown> = {}) {
	return {
		busy: false,
		pending: false,
		assertProject: (projectId: string) => {
			if (projectId !== 'local-example') throw new Error('Unknown project.');
		},
		requireProject: () => ({ root: temporaryRoot() }),
		mutable: async () => ({ root: temporaryRoot() }),
		open: async (root: string) => ({ root }),
		arbiter: { exclusive: async (_root: string, operation: () => unknown) => operation() },
		...overrides
	};
}

function failure(error: unknown) {
	return error instanceof Error ? { name: error.name, message: error.message } : String(error);
}

async function captureFailure(operation: () => Promise<unknown>) {
	try {
		await operation();
		return null;
	} catch (error) {
		return failure(error);
	}
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('Rejects creation while a project operation is active', async () => {
	const service = new GameProjectService(makeSession({ busy: true }) as never, temporaryRoot());
	const result = await captureFailure(() =>
		service.create({ name: 'moon-runner', kind: 'game', dimension: '2d' } as never)
	);
	expect(result).toEqual({ name: 'GameProjectBusyError', message: 'Wait for the current project operation.' });
	expect(new GameProjectBusyError('example')).toBeInstanceOf(Error);
	recordExampleCases({
		unitId: 'desktop.service.game-project', symbol: 'create',
		state: 'rejects-creation-while-a-project-operation-is-active', evidence: 'examples-cases',
		file: 'rejects-creation-while-a-project-operation-is-active.json'
	}, [{
		name: 'Busy session blocks creation before making its target folder',
		input: { busy: true, project: { name: 'moon-runner', kind: 'game', dimension: '2d' } },
		output: result
	}]);
});

test('Rejects reads for an unknown project', async () => {
	const service = new GameProjectService(makeSession() as never, temporaryRoot());
	const result = await captureFailure(() => service.read({ projectId: 'local-missing' } as never));
	expect(result).toEqual({ name: 'Error', message: 'Unknown project.' });
	recordExampleCases({
		unitId: 'desktop.service.game-project', symbol: 'read',
		state: 'rejects-reads-for-an-unknown-project', evidence: 'examples-cases',
		file: 'rejects-reads-for-an-unknown-project.json'
	}, [{
		name: 'Unknown project id is rejected before document access',
		input: { projectId: 'local-missing', commit: '3b7e9d1f0c4a6e2b8d5f7a9c1e3b5d7f9a1c3e5b' },
		output: result
	}]);
});

test('Rejects saves for an unknown project', async () => {
	const service = new GameProjectService(makeSession() as never, temporaryRoot());
	const input = {
		projectId: 'local-missing', document: { version: 1, views: [], mechanics: [] },
		expectedRevision: 'a7f3c91e5b2d08f46c1e9a3b7d5f2c8e0b4a6d9f1c3e7b5a2d8f0c6e4b9a1d37'
	};
	const result = await captureFailure(() => service.save(input as never));
	expect(result).toEqual({ name: 'Error', message: 'Unknown project.' });
	recordExampleCases({
		unitId: 'desktop.service.game-project', symbol: 'save',
		state: 'rejects-saves-for-an-unknown-project', evidence: 'examples-cases',
		file: 'rejects-saves-for-an-unknown-project.json'
	}, [{ name: 'Unknown project id is rejected before document mutation', input, output: result }]);
});

test('Rejects creation when the project folder already exists', async () => {
	const root = temporaryRoot();
	const service = new GameProjectService(makeSession() as never, root);
	await import('node:fs/promises').then(({ mkdir }) => mkdir(join(root, 'Harbor Lights')));
	const input = { name: 'Harbor Lights', kind: 'game', dimension: '3d' };
	const result = await captureFailure(() => service.create(input as never));
	expect(result).toEqual({ name: 'GameProjectAlreadyExistsError', message: 'A project with that name already exists.' });
	expect(new GameProjectAlreadyExistsError('example')).toBeInstanceOf(Error);
	recordExampleCases({
		unitId: 'desktop.service.game-project', symbol: 'create',
		state: 'rejects-creation-when-the-project-folder-already-exists', evidence: 'examples-cases',
		file: 'rejects-creation-when-the-project-folder-already-exists.json'
	}, [{ name: 'Existing project folder is preserved and reported', input, output: result }]);
});
