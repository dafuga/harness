import { Command } from 'commander';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { registerUnitsCommand } from '../src/cli/program/UnitsCommand';
import type { ComponentManifest } from '../src/core/development-tooling/unitTypes';
import { input, invalidCases, manifest, testing } from './units-command.test.fixtures';

const mocks = vi.hoisted(() => ({
	registryRead: vi.fn(),
	registryWrite: vi.fn(),
	readFile: vi.fn(),
	writeFile: vi.fn(),
	mkdir: vi.fn(),
	rename: vi.fn(),
	unlink: vi.fn(),
	rm: vi.fn()
}));

vi.mock('node:fs/promises', async (importOriginal) => {
	const original = await importOriginal<typeof import('node:fs/promises')>();
	return {
		...original,
		readFile: mocks.readFile,
		writeFile: mocks.writeFile,
		mkdir: mocks.mkdir,
		rename: mocks.rename,
		unlink: mocks.unlink,
		rm: mocks.rm
	};
});

vi.mock('../src/repositories/verification-evidence/UnitRegistryRepository', () => ({
	UnitRegistryRepository: vi.fn(() => ({
		read: mocks.registryRead,
		write: mocks.registryWrite
	}))
}));

const inputPath = '/memory/contract.json';
let persistedManifest = '';

function createProgram(): Command {
	const program = new Command();
	program.exitOverride();
	registerUnitsCommand(program);
	return program;
}

async function runContract(id: string): Promise<void> {
	await createProgram().parseAsync([
		'node',
		'units-command-test',
		'units',
		'contract',
		id,
		'--input',
		inputPath,
		'--json'
	]);
}

beforeEach(() => {
	vi.clearAllMocks();
	persistedManifest = JSON.stringify(manifest);
	mocks.readFile.mockResolvedValue(JSON.stringify(input));
	mocks.registryRead.mockResolvedValue({ manifests: [manifest], errors: [], unformatted: [] });
	mocks.registryWrite.mockImplementation(async (manifests: ComponentManifest[]) => {
		persistedManifest = JSON.stringify(manifests[0]);
		return [`specification/units/${manifests[0]?.id}.json`];
	});
});

afterEach(() => vi.restoreAllMocks());

test('registers the existing units commands and the public contract authoring options', () => {
	const units = createProgram().commands.find((command) => command.name() === 'units');
	expect(units?.commands.map((command) => command.name()).sort()).toEqual([
		'check',
		'contract',
		'graph',
		'index',
		'list',
		'retire',
		'schema',
		'show',
		'tests'
	]);
	const contract = units?.commands.find((command) => command.name() === 'contract');
	expect(contract?.options.map((option) => option.long)).toContain('--input');
	expect(contract?.options.map((option) => option.long)).toContain('--json');
});

test('authors the declared contract while preserving the rest of the manifest', async () => {
	const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	const expected: ComponentManifest = {
		...manifest,
		responsibility: input.responsibility,
		responsibilityOrigin: 'declared',
		contract: { origin: 'declared', ...input.contract }
	};
	await runContract(manifest.id);
	expect(mocks.registryRead).toHaveBeenCalledTimes(1);
	expect(mocks.registryWrite).toHaveBeenCalledWith([expected]);
	expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({
		id: manifest.id,
		manifest: expected
	});
	expect(persistedManifest).toBe(JSON.stringify(expected));
	expect(mocks.writeFile).not.toHaveBeenCalled();
	mocks.readFile.mockResolvedValue(JSON.stringify({ ...input, testing }));
	await runContract(manifest.id);
	const withTesting = { ...expected, testing };
	expect(mocks.registryWrite).toHaveBeenLastCalledWith([withTesting]);
	expect(JSON.parse(String(log.mock.calls.at(-1)?.[0]))).toEqual({
		id: manifest.id,
		manifest: withTesting
	});
	expect(persistedManifest).toBe(JSON.stringify(withTesting));
	expect(mocks.writeFile).not.toHaveBeenCalled();
});

test.each(invalidCases)(
	'$name fails without writing registry state',
	async ({ id, text, manifests }) => {
		mocks.readFile.mockResolvedValue(text);
		mocks.registryRead.mockResolvedValue({ manifests, errors: [], unformatted: [] });
		const before = persistedManifest;
		const error = await runContract(id).then(
			() => undefined,
			(reason: unknown) => reason
		);
		expect(error).toBeInstanceOf(Error);
		expect(error).not.toHaveProperty('code', 'commander.unknownCommand');
		expect(mocks.registryWrite).not.toHaveBeenCalled();
		expect(mocks.writeFile).not.toHaveBeenCalled();
		expect(mocks.rename).not.toHaveBeenCalled();
		expect(persistedManifest).toBe(before);
	}
);
