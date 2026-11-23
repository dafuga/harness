import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { deploymentWorktree } from '../../src/utils/projects-sessions/deploymentWorktree';
import { test, vi } from 'vitest';

const resolvedCommit = 'a81d4f0c93e27b6d5f1a0e8c4b9d2f7a6e3c1b05';

function gitAction(command: string): string {
	if (command.includes('worktree add')) return 'worktree add';
	if (command.includes('worktree remove')) return 'worktree remove';
	return 'rev-parse';
}

async function withFakeGitProject<T>(run: (projectRoot: string) => Promise<T>): Promise<T> {
	const fixtureRoot = await mkdtemp(join(tmpdir(), 'deployment-worktree-fixture-'));
	try {
		const projectRoot = join(fixtureRoot, 'project');
		const bin = join(fixtureRoot, 'bin');
		await mkdir(projectRoot, { recursive: true });
		await mkdir(bin, { recursive: true });
		await writeFile(
			join(bin, 'git'),
			`#!/bin/sh
set -eu
[ "$1" = "-C" ]
printf '%s\\n' "$*" >> "$2/git-commands.log"
if [ "$3" = "rev-parse" ]; then
	[ "$6" = "release-candidate^{commit}" ]
	printf '%s\\n' '${resolvedCommit}'
elif [ "$3" = "worktree" ] && [ "$4" = "add" ]; then
	[ "$7" = '${resolvedCommit}' ]
	/bin/mkdir -p "$6"
	printf '%s\\n' "$7" > "$6/commit.txt"
elif [ "$3" = "worktree" ] && [ "$4" = "remove" ]; then
	/bin/rm -rf "$6"
else
	exit 2
fi
`
		);
		await chmod(join(bin, 'git'), 0o755);
		vi.stubEnv('PATH', `${bin}:/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin`);
		return await run(projectRoot);
	} finally {
		vi.unstubAllEnvs();
		await rm(fixtureRoot, { recursive: true, force: true });
	}
}

test('returns its result and removes the detached checkout', async () =>
	withFakeGitProject(async (projectRoot) => {
		let callbackPath = '';
		let callbackCount = 0;
		const result = await deploymentWorktree(projectRoot, 'release-candidate', async (directory) => {
			callbackCount += 1;
			callbackPath = directory;
			const commit = (await readFile(join(directory, 'commit.txt'), 'utf8')).trim();
			return { source: basename(directory), commit };
		});
		const commands = (await readFile(join(projectRoot, 'git-commands.log'), 'utf8'))
			.trim()
			.split('\n');
		const temporaryDirectory = dirname(callbackPath);
		const output = {
			result,
			callbackCount,
			sourceDirectory: basename(callbackPath),
			temporaryDirectoryPrefix: basename(temporaryDirectory).startsWith('harness-deployment-'),
			temporaryDirectoryUnderOsTemp: dirname(temporaryDirectory) === tmpdir(),
			temporaryDirectoryRemoved: !existsSync(temporaryDirectory),
			gitActions: commands.map(gitAction)
		};
		expect(output).toEqual({
			result: { source: 'source', commit: resolvedCommit },
			callbackCount: 1,
			sourceDirectory: 'source',
			temporaryDirectoryPrefix: true,
			temporaryDirectoryUnderOsTemp: true,
			temporaryDirectoryRemoved: true,
			gitActions: ['rev-parse', 'worktree add', 'worktree remove']
		});
		recordExampleCases(
			{
				unitId: 'desktop.function.deployment-worktree',
				symbol: 'deploymentWorktree',
				state: 'returns-its-result-and-removes-the-detached-checkout',
				evidence: 'examples-cases',
				file: 'returns-its-result-and-removes-the-detached-checkout.json'
			},
			[
				{
					name: 'pins a release revision, returns the checkout result, then removes the checkout',
					input: {
						root: 'temporary fake Git project',
						commit: 'release-candidate',
						work: 'read the resolved commit from the checkout'
					},
					output
				}
			]
		);
	}));

test('rethrows callback failures after cleanup', async () =>
	withFakeGitProject(async (projectRoot) => {
		const callbackError = new Error('artifact build failed');
		let callbackPath = '';
		let observedCommit = '';
		let callbackCount = 0;
		let observedError: unknown;
		try {
			await deploymentWorktree(projectRoot, 'release-candidate', async (directory) => {
				callbackCount += 1;
				callbackPath = directory;
				observedCommit = (await readFile(join(directory, 'commit.txt'), 'utf8')).trim();
				throw callbackError;
			});
		} catch (error) {
			observedError = error;
		}
		const commands = await readFile(join(projectRoot, 'git-commands.log'), 'utf8');
		const cleanupObserved = commands.includes('worktree remove --force');
		const temporaryDirectoryRemoved = !existsSync(dirname(callbackPath));
		expect(observedError).toBe(callbackError);
		expect([callbackCount, observedCommit, cleanupObserved, temporaryDirectoryRemoved]).toEqual([
			1,
			resolvedCommit,
			true,
			true
		]);
		recordExampleCases(
			{
				unitId: 'desktop.function.deployment-worktree',
				symbol: 'deploymentWorktree',
				state: 'rethrows-callback-failures-after-cleanup',
				evidence: 'examples-cases',
				file: 'rethrows-callback-failures-after-cleanup.json'
			},
			[
				{
					name: 'passes a callback failure through after removing the checkout',
					input: {
						root: 'temporary fake Git project',
						commit: 'release-candidate',
						work: 'read the checkout commit, then throw an error'
					},
					error: {
						name: 'Error',
						message: callbackError.message,
						callbackCount,
						resolvedCommit: observedCommit,
						cleanupObserved,
						temporaryDirectoryRemoved
					}
				}
			]
		);
	}));
