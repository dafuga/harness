import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import type { ToolCheck } from './checkRunCases.types';
import { runnerFor } from './checkRunCases';

function tool(id: string, command: string): ToolCheck {
	return { id, command };
}

/** Real disposable tools: first nonempty stdout line, empty stdout, nonzero exit, missing tool. */
export async function versionInitialized() {
	const root = await mkdtemp(join(tmpdir(), 'harness-version-'));
	try {
		const service = runnerFor(root);
		await expect(service.version(null as never)).rejects.toThrow(TypeError);
		const firstLine = "printf '\\n   \\n  harness 2.4.1  \\nsecond line\\n'";
		const version = await service.version(tool('first-line', firstLine));
		expect(version).toBe('harness 2.4.1');
		expect(await readFile(join(root, 'logs', 'tool-first-line.log'), 'utf8')).toContain(
			'second line'
		);
		await expect(service.version(tool('empty', 'true'))).resolves.toBeUndefined();
		await expect(service.version(tool('nonzero', 'echo 9.9.9; exit 3'))).resolves.toBeUndefined();
		await expect(
			service.version(tool('missing', 'harness-missing-tool-for-version --version'))
		).resolves.toBeUndefined();
		expect(await readFile(join(root, 'logs', 'tool-missing.log'), 'utf8')).toContain(
			'harness-missing-tool-for-version'
		);
		return version;
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}
