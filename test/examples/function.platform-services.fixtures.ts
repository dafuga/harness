import { chmod, mkdir, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { vi } from 'vitest';
import type {
	ProcessFacts,
	ProcessProbes
} from '../../src/utils/development-tooling/processProbes.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';

export const started = 'Sat Nov 14 12:34:56 2026';

export const privateFacts = {
	parent: 4700,
	group: 900,
	terminal: '??',
	started: 'Sat  Nov 14 12:34:56 2026',
	name: 'python3'
};

export const serviceFacts = { parent: 1, group: 4812, terminal: '??', started, name: 'ibtoold' };

export function makeProbes(
	observed: ProcessFacts | null,
	executable: string | null,
	signatureOk = false
): ProcessProbes {
	return {
		ran: async () => ({ ok: signatureOk, out: '' }),
		facts: async () => observed,
		executable: async () => executable
	};
}

export function record(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
): void {
	recordExampleCases(
		{
			unitId: 'function.platform-services',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

export async function withFakeSelector<T>(
	use: (fixture: { directory: string; developer: string; selector: string }) => Promise<T>
): Promise<T> {
	return withTempDir('platform-services-examples-', async (directory) => {
		const bin = join(directory, 'bin');
		const developerAlias = join(directory, 'Xcode.app/Contents/Developer');
		const selector = join(bin, 'xcode-select');
		await mkdir(bin, { recursive: true });
		await mkdir(developerAlias, { recursive: true });
		const developer = await realpath(developerAlias);
		await writeSelector(selector, developer);
		await chmod(selector, 0o755);
		vi.stubEnv('PATH', bin);
		try {
			return await use({ directory, developer, selector });
		} finally {
			vi.unstubAllEnvs();
		}
	});
}

export async function writeSelector(selector: string, selected: string): Promise<void> {
	await writeFile(selector, `#!/bin/sh\n[ "$1" = "-p" ] || exit 2\nprintf '%s\\n' '${selected}'\n`);
}
