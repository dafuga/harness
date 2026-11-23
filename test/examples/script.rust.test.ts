import { test } from 'vitest';
import { pinnedToolchain } from '../../scripts/build-kernel/pinnedToolchain';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function caught(run: () => unknown): { name: string; message: string } {
	let value: unknown;
	try {
		run();
	} catch (error) {
		value = error;
	}
	expect(value).toBeInstanceOf(Error);
	const error = value as Error;
	return { name: error.name, message: error.message };
}

function pin(project: string, content = '[toolchain]\nchannel = "stable"\n'): void {
	mkdirSync(project);
	writeFileSync(join(project, 'rust-toolchain.toml'), content);
}

function record(
	state: string,
	cases: Array<{ name: string; input: unknown; error: unknown }>
): void {
	recordExampleCases(
		{
			unitId: 'script.rust',
			symbol: 'pinnedToolchain',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

function mockToml(channel: string): void {
	(globalThis as unknown as { Bun: { TOML: { parse: (text: string) => unknown } } }).Bun = {
		TOML: { parse: () => ({ toolchain: { channel } }) }
	};
}

test('Selects the pinned Rust compiler toolchain', async () => {
	await withTempDir('rust-script-', (root) => {
		mockToml('stable');
		const project = join(root, 'project');
		pin(project);
		const output = pinnedToolchain('cargo', {
			cwd: project,
			env: { PATH: '/fake/bin' },
			run: (_command, args, cwd, env) => {
				expect(args).toEqual(['which', '--toolchain', 'stable', 'cargo']);
				expect(cwd).toBe(project);
				expect(env.RUSTUP_TOOLCHAIN).toBe('stable');
				return { status: 0, stdout: '/toolchains/stable/bin/cargo\n', stderr: '', failed: false };
			}
		});
		expect(output.command).toBe('/toolchains/stable/bin/cargo');
		expect(output.env.RUSTC).toBe('/toolchains/stable/bin/rustc');
		recordExampleCases(
			{
				unitId: 'script.rust',
				symbol: 'pinnedToolchain',
				state: 'selects-the-pinned-rust-compiler-toolchain',
				evidence: 'examples-cases',
				file: 'selects-the-pinned-rust-compiler-toolchain.json'
			},
			[
				{
					name: 'selects cargo from stable',
					input: { tool: 'cargo', channel: 'stable' },
					output: { command: output.command, rustc: output.env.RUSTC }
				}
			]
		);
	});
});

test('Throws Error when tool or working directory is invalid', async () => {
	const toolError = caught(() => pinnedToolchain('Cargo'));
	expect(toolError.message).toBe('"Cargo" is not a Rust tool name.');
	await withTempDir('rust-script-', (root) => {
		const cwd = join(root, 'missing');
		const directoryError = caught(() => pinnedToolchain('cargo', { cwd }));
		expect(directoryError.message).toBe(`Rust toolchain directory does not exist: ${cwd}`);
		record('throws-error-when-tool-or-working-directory-is-invalid', [
			{ name: 'rejects uppercase tool', input: { tool: 'Cargo' }, error: toolError },
			{ name: 'rejects missing directory', input: { tool: 'cargo', cwd }, error: directoryError }
		]);
	});
});

test('Throws pin errors for missing, unreadable, or invalid toolchain files', async () => {
	await withTempDir('rust-script-', (root) => {
		const missing = join(root, 'missing');
		mkdirSync(missing);
		const missingError = caught(() => pinnedToolchain('cargo', { cwd: missing }));
		expect(missingError.message).toContain('No rust-toolchain.toml found');
		const unreadable = join(root, 'unreadable');
		mkdirSync(unreadable);
		mkdirSync(join(unreadable, 'rust-toolchain.toml'));
		const readError = caught(() => pinnedToolchain('cargo', { cwd: unreadable }));
		expect(readError.message.length).toBeGreaterThan(0);
		const invalid = join(root, 'invalid');
		pin(invalid, '[toolchain]\\nchannel = " stable "\\n');
		mockToml(' stable ');
		const invalidError = caught(() => pinnedToolchain('cargo', { cwd: invalid }));
		expect(invalidError.message).toContain('toolchain.channel must be a nonempty string');
		record('throws-pin-errors-for-missing-unreadable-or-invalid-toolchai', [
			{ name: 'reports missing pin', input: { cwd: missing }, error: missingError },
			{ name: 'passes through read failure', input: { cwd: unreadable }, error: readError },
			{
				name: 'rejects padded channel',
				input: { cwd: invalid, channel: ' stable ' },
				error: invalidError
			}
		]);
	});
});

test('Throws Bun.spawnSync error when tool execution throws', async () => {
	await withTempDir('rust-script-', (root) => {
		const project = join(root, 'project');
		pin(project);
		mockToml('stable');
		const thrown = caught(() =>
			pinnedToolchain('cargo', {
				cwd: project,
				run: () => {
					throw new Error('spawn failed');
				}
			})
		);
		expect(thrown.message).toBe('spawn failed');
		record('throws-bun-spawnsync-error-when-tool-execution-throws', [
			{
				name: 'passes through thrown tool execution error',
				input: { tool: 'cargo', thrown: 'spawn failed' },
				error: thrown
			}
		]);
	});
});

test('Throws Error when rustup selection fails', async () => {
	await withTempDir('rust-script-', (root) => {
		const project = join(root, 'project');
		pin(project);
		mockToml('stable');
		const missing = caught(() =>
			pinnedToolchain('cargo', {
				cwd: project,
				run: () => ({ status: null, stdout: '', stderr: '', failed: true })
			})
		);
		expect(missing.message).toContain('rustup was not found');
		const rejected = caught(() =>
			pinnedToolchain('cargo', {
				cwd: project,
				run: () => ({ status: 1, stdout: '', stderr: 'not installed', failed: false })
			})
		);
		expect(rejected.message).toContain('rustup could not select cargo');
		const empty = caught(() =>
			pinnedToolchain('cargo', {
				cwd: project,
				run: () => ({ status: 0, stdout: '  ', stderr: '', failed: false })
			})
		);
		expect(empty.message).toContain('rustup named no cargo');
		record('throws-error-when-rustup-selection-fails', [
			{ name: 'reports missing rustup', input: { tool: 'cargo', failed: true }, error: missing },
			{ name: 'reports rustup rejection', input: { tool: 'cargo', status: 1 }, error: rejected },
			{ name: 'reports empty tool path', input: { tool: 'cargo', stdout: '  ' }, error: empty }
		]);
	});
});
