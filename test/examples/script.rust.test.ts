import { test } from 'vitest';
import { pinnedToolchain } from '../../scripts/build-kernel/pinnedToolchain';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

test('Selects the pinned Rust compiler toolchain', async () => {
	await withTempDir('rust-script-', (root) => {
		(globalThis as unknown as { Bun: { TOML: { parse: (text: string) => unknown } } }).Bun = {
			TOML: { parse: () => ({ toolchain: { channel: 'stable' } }) }
		};
		const project = join(root, 'project');
		mkdirSync(project);
		writeFileSync(join(project, 'rust-toolchain.toml'), '[toolchain]\nchannel = "stable"\n');
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
