import type { Environment, KernelArtifacts, KernelBuild } from './kernelArtifacts.types';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export type {
	Environment,
	KernelBuild,
	KernelFile,
	KernelArtifacts
} from './kernelArtifacts.types';
