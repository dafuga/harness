import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { afterAll, expect, test, vi } from 'vitest';
import { pinnedToolchain, type ToolRun } from '../../src/utils/pinnedToolchain';
import { recordCapture } from '../../src/utils/recordCapture';

/**
 * Which Rust tool an entry point of this project runs. It is the one of the toolchain that
 * rust-toolchain.toml pins, found through rustup, whatever cargo is first on PATH; and when
 * rustup or that toolchain is missing it is none at all.
 */
const root = resolve(import.meta.dirname, '../..');
// Vitest runs on Node; use the real Bun TOML parser used by the script runtime.
vi.stubGlobal('Bun', {
	TOML: {
		parse(text: string) {
			const result = spawnSync(
				'bun',
				['-e', 'console.log(JSON.stringify(Bun.TOML.parse(await Bun.stdin.text())))'],
				{ input: text, encoding: 'utf8' }
			);
			if (result.status !== 0) throw new Error(result.stderr);
			return JSON.parse(result.stdout);
		}
	}
});
afterAll(() => vi.unstubAllGlobals());
const channel = /channel\s*=\s*"([^"]+)"/.exec(
	readFileSync(`${root}/rust-toolchain.toml`, 'utf8')
)![1];
const bin = '/made/up/toolchains/pinned-host/bin';
const env = { PATH: '/opt/elsewhere/bin:/usr/bin', HOME: '/made/up/home' };
/** A rustup that answers as given, and every call that was made of it. */
function rustup(answer: Partial<ReturnType<ToolRun>>) {
	const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
	const run: ToolRun = (command, args, cwd) => {
		calls.push({ command, args, cwd });
		return { status: 0, stdout: '', stderr: '', failed: false, ...answer };
	};
	return { run, calls };
}

test('the tool is the one rustup names for this directory, with its own directory first on PATH', () => {
	const { run, calls } = rustup({ stdout: `${bin}/cargo\n` });
	const pinned = pinnedToolchain('cargo', { cwd: root, env, run });
	expect(pinned.command).toBe(`${bin}/cargo`);
	expect(pinned.env.PATH).toBe(`${bin}:/opt/elsewhere/bin:/usr/bin`);
	expect(pinned.env.HOME).toBe('/made/up/home');
	expect(pinned.env.DYLD_LIBRARY_PATH).toBe('/made/up/toolchains/pinned-host/lib');
	// Explicit selection must override both environment and rustup directory overrides.
	expect(calls).toEqual([
		{ command: 'rustup', args: ['which', '--toolchain', channel, 'cargo'], cwd: root }
	]);
	const source = 'src/utils/pinnedToolchain.ts';
	const sha256 = createHash('sha256')
		.update(readFileSync(`${root}/${source}`))
		.digest('hex');
	recordCapture(
		{
			evidence: 'selection',
			kind: 'assertions',
			state: 'child-environment',
			file: 'pinned-toolchain-cases.json',
			mediaType: 'application/json'
		},
		JSON.stringify({
			schemaVersion: 1,
			kind: 'function-invocations',
			unitId: 'function.pinned-toolchain',
			symbol: 'pinnedToolchain',
			source: { path: source, sha256 },
			cases: [
				{
					name: 'Select cargo from a synthetic Rustup result',
					input: { tool: 'cargo', environment: env, resolvedTool: `${bin}/cargo` },
					output: pinned
				}
			]
		})
	);
});

test('without rustup nothing is run in its place, and the failure says what is missing', () => {
	const { run, calls } = rustup({ failed: true, status: null });
	expect(() => pinnedToolchain('cargo', { cwd: root, env, run })).toThrow(
		/rustup was not found.*rust-toolchain\.toml/s
	);
	expect(calls).toHaveLength(1);
});

test('a pinned toolchain that is not installed fails in the words of rustup', () => {
	const missing = "error: toolchain '9.9.9-host' is not installed";
	const { run, calls } = rustup({ status: 1, stderr: `${missing}\n` });
	expect(() => pinnedToolchain('rustc', { cwd: root, env, run })).toThrow(
		/toolchain '9\.9\.9-host' is not installed.*rustup toolchain install/s
	);
	expect(calls).toHaveLength(1);
	// An answer that names no tool is no tool either.
	expect(() => pinnedToolchain('cargo', { cwd: root, env, run: rustup({}).run })).toThrow(
		/rustup named no cargo/
	);
});

test('only a plain tool name is asked for', () => {
	const { run, calls } = rustup({ stdout: `${bin}/cargo\n` });
	for (const name of ['', '--toolchain', 'cargo fmt', '../cargo', 'cargo;true'])
		expect(() => pinnedToolchain(name, { cwd: root, env, run })).toThrow(/not a Rust tool name/);
	expect(calls).toEqual([]);
});

const installed =
	spawnSync('rustup', ['which', '--toolchain', channel, 'cargo'], { cwd: root }).status === 0;
test.skipIf(!installed)(
	'on this machine cargo and the rustc it finds are those of the pin, whatever PATH has first',
	() => {
		const pin = /channel\s*=\s*"([^"]+)"/.exec(readFileSync(`${root}/rust-toolchain.toml`, 'utf8'));
		const cargo = pinnedToolchain('cargo', { cwd: root });
		const said = (command: string) =>
			spawnSync(command, ['--version'], { env: cargo.env, encoding: 'utf8' }).stdout;
		expect(said(cargo.command)).toContain(`cargo ${pin?.[1]}`);
		// What cargo itself starts is looked up on the PATH it was given.
		expect(said('rustc')).toContain(`rustc ${pin?.[1]}`);
		expect(dirname(pinnedToolchain('rustc', { cwd: root }).command)).toBe(dirname(cargo.command));
	}
);

test('compiler overrides are sanitized in the child only and rustup receives that same environment', () => {
	const original = {
		...env,
		RUSTUP_TOOLCHAIN: 'review-nonexistent-toolchain',
		RUSTC: '/wrong/rustc',
		RUSTC_WRAPPER: '/wrong/wrapper',
		RUSTC_WORKSPACE_WRAPPER: '/wrong/workspace'
	};
	const seen: unknown[] = [];
	const run: ToolRun = (...args) => {
		seen.push(args[3]);
		return { status: 0, stdout: `${bin}/cargo`, stderr: '', failed: false };
	};
	const cargo = pinnedToolchain('cargo', { cwd: root, env: original, run });
	expect(cargo.env.RUSTUP_TOOLCHAIN).toBe(channel);
	expect(cargo.env.RUSTC).toBe(`${bin}/rustc`);
	for (const name of ['RUSTC_WRAPPER', 'RUSTC_WORKSPACE_WRAPPER']) expect(cargo.env[name]).toBe('');
	expect(seen).toEqual([expect.objectContaining({ RUSTUP_TOOLCHAIN: channel, RUSTC: 'rustc' })]);
	expect(original.RUSTC).toBe('/wrong/rustc');
	expect(original.RUSTUP_TOOLCHAIN).toBe('review-nonexistent-toolchain');
});

test('a nested cwd finds its ancestor pin; missing and malformed pins fail before rustup', () => {
	const folder = mkdtempSync(`${tmpdir()}/harness-pinned-rust-`);
	const nested = `${folder}/nested`;
	mkdirSync(nested);
	const { run, calls } = rustup({ stdout: `${bin}/cargo` });
	expect(() => pinnedToolchain('cargo', { cwd: nested, run })).toThrow(/rust-toolchain.toml/);
	expect(() => pinnedToolchain('cargo', { cwd: `${folder}/absent`, run })).toThrow(/directory/);
	for (const content of [
		'[toolchain]\nchannel =',
		'[toolchain]\nchannel = 99',
		'[toolchain]\nprofile = "minimal"',
		'[toolchain]\nchannel = ""',
		'[toolchain]\nchannel = "stable"\nchannel = "beta"'
	]) {
		writeFileSync(`${folder}/rust-toolchain.toml`, content);
		expect(() => pinnedToolchain('cargo', { cwd: nested, run })).toThrow(/rust-toolchain.toml/);
	}
	expect(calls).toEqual([]);
	writeFileSync(
		`${folder}/rust-toolchain.toml`,
		"[toolchain]\nchannel = 'test-pin' # valid TOML\n"
	);
	pinnedToolchain('cargo', { cwd: nested, run });
	expect(calls[0].args).toEqual(['which', '--toolchain', 'test-pin', 'cargo']);
});

test.skipIf(!installed)(
	'the real entry point ignores an unavailable override and preserves tool exit codes',
	() => {
		const childEnv = {
			...process.env,
			RUSTUP_TOOLCHAIN: 'review-nonexistent-toolchain',
			RUSTC: '/wrong/rustc',
			RUSTC_WRAPPER: '/wrong/wrapper',
			RUSTC_WORKSPACE_WRAPPER: '/wrong/workspace'
		};
		const version = spawnSync('bun', ['scripts/rust.ts', 'cargo', '--version'], {
			cwd: root,
			env: childEnv,
			encoding: 'utf8'
		});
		expect(version.status, version.stderr).toBe(0);
		expect(version.stdout).toContain(`cargo ${channel}`);
		const invalid = spawnSync('bun', ['scripts/rust.ts', 'rustc', '--review-invalid-argument'], {
			cwd: root,
			env: childEnv
		});
		expect(invalid.status).toBe(1);
	}
);
