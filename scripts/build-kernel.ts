import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pinnedToolchain } from '../src/utils/pinnedToolchain';

const out = 'target/kernel';
const rawWasm = 'target/wasm32-unknown-unknown/release/impact_kernel.wasm';
const features = ['--enable-bulk-memory', '--enable-sign-ext', '--enable-nontrapping-float-to-int'];
const reference = [
	'impactKernel.ts',
	'kernelRequest.ts',
	'kernelClosure.ts',
	'portableJson.ts'
].map((file) => `src/utils/${file}`);

function run(command: string[], env?: Record<string, string | undefined>): string {
	const result = Bun.spawnSync(command, { stdout: 'pipe', stderr: 'inherit', env });
	if (result.exitCode !== 0) throw new Error(`${command.join(' ')} failed`);
	return result.stdout.toString().trim();
}

/** Runs cargo or rustc of the toolchain rust-toolchain.toml pins; what is recorded is that one. */
function rust(tool: 'cargo' | 'rustc', args: string[]): string {
	const pinned = pinnedToolchain(tool);
	return run([pinned.command, ...args], pinned.env);
}

/** Shrinks the module when wasm-opt is installed; otherwise ships the compiler output as is. */
async function optimize(target: string): Promise<string | null> {
	const tool = Bun.which('wasm-opt');
	const attempt = tool
		? Bun.spawnSync([tool, '-Oz', ...features, rawWasm, '-o', target], { stderr: 'pipe' })
		: undefined;
	if (attempt?.exitCode === 0) return run([tool ?? '', '--version']);
	await copyFile(rawWasm, target);
	if (attempt) console.error(`wasm-opt failed; shipping unoptimized Wasm.\n${attempt.stderr}`);
	return null;
}

async function describe(path: string) {
	const bytes = await readFile(path);
	return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

async function sources(files: string[]) {
	const described = await Promise.all(files.sort().map(describe));
	return { bytes: described.reduce((total, file) => total + file.bytes, 0), files: described };
}

rust('cargo', ['build', '--release', '--locked', '--bin', 'impact-kernel']);
rust('cargo', ['build', '--release', '--locked', '--lib', '--target', 'wasm32-unknown-unknown']);
await mkdir(out, { recursive: true });
const wasmOpt = await optimize(join(out, 'impact-kernel.wasm'));
await copyFile('target/release/impact-kernel', join(out, 'impact-kernel'));
const crate = (await readdir('crates/impact-kernel/src')).map(
	(file) => `crates/impact-kernel/src/${file}`
);
const build = {
	contract: 'impact-kernel/1',
	rustc: rust('rustc', ['--version']),
	host: rust('rustc', ['--print', 'host-tuple']),
	wasmOpt,
	rawWasmBytes: (await describe(rawWasm)).bytes,
	wasm: await describe(join(out, 'impact-kernel.wasm')),
	native: await describe(join(out, 'impact-kernel')),
	sources: {
		crate: await sources([...crate, 'crates/impact-kernel/Cargo.toml']),
		reference: await sources(reference)
	}
};
await writeFile(join(out, 'build.json'), `${JSON.stringify(build, null, '\t')}\n`);
console.log(
	`Built impact kernel: wasm ${build.wasm.bytes} bytes (wasm-opt ${wasmOpt ?? 'not applied'}), ` +
		`native ${build.native.bytes} bytes.`
);
