import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Environment variables, as `process.env` exposes them. */
export type Environment = Record<string, string | undefined>;

export interface KernelBuild {
	contract: string;
	rustc: string;
	host: string;
	wasmOpt: string | null;
	wasm: KernelFile;
	native: KernelFile;
	sources: Record<'crate' | 'reference', { bytes: number; files: KernelFile[] }>;
}

export interface KernelFile {
	path: string;
	bytes: number;
	sha256: string;
}

export interface KernelArtifacts {
	directory: string | undefined;
	/** Core Wasm module, when built or shipped. */
	wasm: string | undefined;
	/** Native JSON process, when built for this machine. */
	native: string | undefined;
	build: KernelBuild | undefined;
}

/** Where built kernels may live: an override, beside a bundle, or in a source checkout. */
function candidates(env: Environment): string[] {
	const beside = [
		new URL('../kernel/', import.meta.url),
		new URL('../../kernel/', import.meta.url),
		new URL('../../../target/kernel/', import.meta.url)
	].map((url) => fileURLToPath(url));
	return env.HARNESS_KERNEL_DIR ? [resolve(env.HARNESS_KERNEL_DIR)] : beside;
}

/** Locates the built impact kernel without building anything. */
export function kernelArtifacts(env: Environment = process.env): KernelArtifacts {
	const directory = candidates(env).find((path) => existsSync(join(path, 'build.json')));
	if (!directory)
		return { directory: undefined, wasm: undefined, native: undefined, build: undefined };
	const file = (name: string) =>
		existsSync(join(directory, name)) ? join(directory, name) : undefined;
	const build = JSON.parse(readFileSync(join(directory, 'build.json'), 'utf8')) as KernelBuild;
	return { directory, wasm: file('impact-kernel.wasm'), native: file('impact-kernel'), build };
}
