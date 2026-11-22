import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

test('Runs the app audit command', () => {
	const directory = mkdtempSync(join(tmpdir(), 'reports-harness-audit-'));
	const binDirectory = join(directory, 'bin');
	const scriptPath = fileURLToPath(new URL('../../scripts/harness-audit.ts', import.meta.url));
	const bunPath = '/Users/danielfugere/.bun/bin/bun';
	try {
		mkdirSync(binDirectory);
		const fakeHarness = join(binDirectory, 'harness');
		writeFileSync(fakeHarness, '#!/bin/sh\nprintf "%s\\n" "$*"\n');
		chmodSync(fakeHarness, 0o755);
		const output = execFileSync(bunPath, [scriptPath], {
			cwd: directory,
			env: { PATH: binDirectory },
			encoding: 'utf8',
			timeout: 20_000
		}).trim();
		expect(output).toBe('audit . --profile app');
		recordExampleCases(
			{
				unitId: 'reports.script.harness-audit',
				symbol: 'harness-audit',
				state: 'runs-the-app-audit-command',
				evidence: 'examples-cases',
				file: 'runs-the-app-audit-command.json'
			},
			[
				{
					name: 'invokes the app-profile audit in the temporary project',
					input: { cwd: directory },
					output
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
