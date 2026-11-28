import { expect } from 'vitest';
import { runCommand } from './cli';

/** The installed CLI bundle must load the Wasm kernel its own package ships. */
export async function expectPackedCliKernel(project: string): Promise<void> {
	const cli = 'node_modules/@dafuga01/harness/dist/index.js';
	// The native binary is not published, so the whole parity report stays incomplete.
	const parity = await runCommand(['bun', cli, 'kernel', 'parity', '--json'], project, false);
	expect(JSON.parse(parity.stdout).runtimes).toContainEqual({
		runtime: 'wasm',
		available: true,
		mismatches: 0
	});
}
