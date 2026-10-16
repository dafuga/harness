import { spawnSync } from 'node:child_process';
import { constants, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const channel = /channel\s*=\s*"([^"]+)"/.exec(
	readFileSync(join(root, 'rust-toolchain.toml'), 'utf8')
)![1];

function rust(command: string, args: string[]): string {
	const result = spawnSync('rustup', ['run', channel, command, ...args], {
		cwd: root,
		encoding: 'utf8'
	});
	expect(result.status, result.stderr).toBe(0);
	return result.stdout.trim();
}

/** Copy the distributed files, without any host-installed library symlinks. */
function isolatedTools(folder: string): string {
	const sysroot = rust('rustc', ['--print', 'sysroot']);
	const host = rust('rustc', ['--print', 'host-tuple']);
	const bin = join('lib', 'rustlib', host, 'bin');
	mkdirSync(join(folder, bin), { recursive: true });
	mkdirSync(join(folder, 'bin'));
	for (const file of [
		'lib/libLLVM.dylib',
		...['rust-lld', 'rust-objcopy'].map((name) => join(bin, name))
	])
		copyFileSync(join(sysroot, file), join(folder, file), constants.COPYFILE_FICLONE);
	return join(folder, bin);
}

function selectedEnvironment(folder: string): Record<string, string | undefined> {
	const code = `
		import { pinnedToolchain } from './src/utils/pinnedToolchain';
		const folder = process.argv[1];
		const answer = { status: 0, failed: false, stderr: '', stdout: folder + '/bin/cargo' };
		const env = { PATH: '/usr/bin', HOME: folder,
			DYLD_LIBRARY_PATH: folder + '/unrelated', DYLD_FALLBACK_LIBRARY_PATH: '' };
		console.log(JSON.stringify(pinnedToolchain('cargo', { env, run: () => answer }).env));
	`;
	const result = spawnSync('bun', ['-e', code, folder], { cwd: root, encoding: 'utf8' });
	expect(result.status, result.stderr).toBe(0);
	return JSON.parse(result.stdout);
}

test.runIf(process.platform === 'darwin')(
	'the selected tool environment runs bundled link and strip tools without host repairs',
	() => {
		const folder = mkdtempSync(join(tmpdir(), 'harness-rust-libraries-'));
		try {
			const bin = isolatedTools(folder);
			const env = selectedEnvironment(folder);
			for (const [tool, args] of [
				['rust-lld', ['-flavor', 'wasm', '--version']],
				['rust-objcopy', ['--version']]
			] as const) {
				const result = spawnSync(join(bin, tool), args, { env, encoding: 'utf8' });
				expect(result.status, `${tool}: ${result.stderr}`).toBe(0);
				expect(result.stdout).toMatch(/LLD|LLVM/);
			}
			expect(env.DYLD_LIBRARY_PATH?.split(':')).toEqual([
				join(folder, 'lib'),
				join(folder, 'unrelated')
			]);
		} finally {
			rmSync(folder, { recursive: true, force: true });
		}
	}
);
