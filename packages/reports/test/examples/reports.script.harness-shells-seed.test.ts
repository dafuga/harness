import type { VerificationSeed } from '../../scripts/harness-emitted-seed.types';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { shellsBranch, shellUnit, seedShells } from '../../scripts/harness-shells-seed';

function repository(directory: string): Parameters<typeof seedShells>[0] {
	let commitNumber = 0;
	const commits = ['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40), 'd'.repeat(40)];
	return {
		git: async () => '',
		write: async () => undefined,
		harness: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
		json: async () => ({ name: 'TitleFrame', kind: 'component' }),
		commit: async () => commits[commitNumber++],
		change: async () => commits[commitNumber++],
		directory
	} as unknown as Parameters<typeof seedShells>[0];
}

test('Seeds the shell history', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'shells-seed-'));
	try {
		const calls: string[] = [];
		const callbacks: VerificationSeed = {
			verified: async () => {
				calls.push('verified');
				return { record: { id: 'verification-record' } } as Awaited<
					ReturnType<VerificationSeed['verified']>
				>;
			},
			explain: async (_repo, behavior) => {
				calls.push(behavior);
				return { exitCode: 0, stdout: '', stderr: '' };
			}
		};
		const commits = await seedShells(
			repository(directory),
			callbacks,
			'abcdef0123456789abcdef0123456789abcdef01'
		);
		expect(commits).toEqual({
			framed: 'a'.repeat(40),
			framedBaseline: 'b'.repeat(40),
			shelled: 'c'.repeat(40),
			shellRetained: 'd'.repeat(40)
		});
		expect(calls).toHaveLength(6);
		expect(shellsBranch).toBe('feature/shells');
		expect(shellUnit).toBe('component.title-frame');
		recordExampleCases(
			{
				unitId: 'reports.script.harness-shells-seed',
				symbol: 'seedShells',
				state: 'seeds-the-shell-history',
				evidence: 'examples-cases',
				file: 'seeds-the-shell-history.json'
			},
			[
				{
					name: 'seeds shell history and leaves main checked out',
					input: {
						from: 'abcdef0123456789abcdef0123456789abcdef01',
						branch: shellsBranch,
						unit: shellUnit
					},
					output: commits
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
