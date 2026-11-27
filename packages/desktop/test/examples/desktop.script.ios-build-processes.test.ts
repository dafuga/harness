import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { followed } from '../../scripts/ios-build-processes';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function fakeTool(directory: string, name: string, body: string): string {
	const executable = join(directory, name);
	writeFileSync(executable, `#!/bin/sh\n${body}\n`);
	chmodSync(executable, 0o755);
	return executable;
}

test('returns exit code and output from a completed build', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'ios-build-processes-'));
	try {
		vi.stubEnv('LC_ALL', 'en_CA.UTF-8');
		const executable = fakeTool(
			directory,
			'xcodebuild',
			`[ "$LC_ALL" = en_CA.UTF-8 ] || exit 1
printf '** BUILD FAILED **\\n'; exit 65`
		);
		const command = [executable, '-version'];
		const result = await followed(command);
		expect(result).toEqual({ code: 65, output: '** BUILD FAILED **\n', left: null });
		recordExampleCases(
			{
				unitId: 'desktop.script.ios-build-processes',
				symbol: 'followed',
				state: 'returns-exit-code-and-output-from-a-completed-build',
				evidence: 'examples-cases',
				file: 'returns-exit-code-and-output-from-a-completed-build.json'
			},
			[{ name: 'xcodebuild failure output', input: ['xcodebuild', '-version'], output: result }]
		);
	} finally {
		vi.unstubAllEnvs();
		rmSync(directory, { recursive: true, force: true });
	}
});

test('rejects an empty command before a build tool starts', async () => {
	let thrown: unknown;
	try {
		await followed([]);
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(TypeError);
	if (!(thrown instanceof TypeError)) throw new Error('Expected an empty command TypeError.');
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-build-processes',
			symbol: 'followed',
			state: 'rejects-an-empty-command-before-a-build-tool-starts',
			evidence: 'examples-cases',
			file: 'rejects-an-empty-command-before-a-build-tool-starts.json'
		},
		[
			{
				name: 'empty executable list',
				input: [],
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
