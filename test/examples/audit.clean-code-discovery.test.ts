import type { CollectedInput } from './audit.clean-code-discovery.test.types';
import { test } from 'vitest';
import { chmodSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import {
	discoverCleanCodeFiles,
	matchesExclusion
} from '../../src/audit/development-tooling/cleanCodeDiscovery';

const sourceFiles = [
	'README.md',
	'scripts/local-setup.sh',
	'src/audit/cleanCodeDiscovery.ts',
	'src/legacy/parser.ts',
	'packages/api/.env.local',
	'src/api/client.gen.ts',
	'vendor/lib/parser.js'
];
const configuredExclusions = ['src/legacy/**'];
const gitIgnoredFiles = 'scripts/local-setup.sh\n';

function collectedIn(root: string): CollectedInput {
	return {
		files: sourceFiles.map((path) => ({
			path: join(root, path),
			extension: extname(path)
		})),
		dirs: [],
		ignoredPaths: ['dist/']
	};
}

const expectedExcludedPaths = [
	{ path: 'dist/', reason: 'Artifact directory or symlink' },
	{ path: 'packages/api/.env.local', reason: 'Sensitive or third-party path' },
	{ path: 'scripts/local-setup.sh', reason: 'Git ignored' },
	{ path: 'src/api/client.gen.ts', reason: 'Generated source' },
	{ path: 'src/legacy/parser.ts', reason: 'Configured exclusion' },
	{ path: 'vendor/lib/parser.js', reason: 'Sensitive or third-party path' }
];

const matchCases = [
	{ path: 'src/legacy/parser.ts', pattern: 'src/legacy/**', expected: true },
	{ path: 'src/legacy/deep/parser.ts', pattern: './src/legacy/**', expected: true },
	{ path: 'docs/guide/index.md', pattern: 'docs/', expected: true },
	{ path: 'packages/web/src/api/client.gen.ts', pattern: '**/*.gen.ts', expected: true },
	{ path: 'src/app/main.ts', pattern: 'src/legacy/**', expected: false },
	{ path: 'SRC/legacy/parser.ts', pattern: 'src/legacy/**', expected: false }
];

test('Selects source files and separates excluded paths', async () => {
	await withTempRepo(async (repository) => {
		writeFileSync(join(repository.root, '.gitignore'), gitIgnoredFiles);
		const coverage = discoverCleanCodeFiles(
			repository.root,
			collectedIn(repository.root),
			configuredExclusions
		);

		expect(coverage.selectedFiles).toEqual(['src/audit/cleanCodeDiscovery.ts']);
		expect(coverage.unsupportedFiles).toEqual(['README.md']);
		expect(coverage.excludedPaths).toEqual(expectedExcludedPaths);

		recordExampleCases(
			{
				unitId: 'audit.clean-code-discovery',
				symbol: 'discoverCleanCodeFiles',
				state: 'selects-source-files-and-separates-excluded-paths',
				evidence: 'examples-cases',
				file: 'selects-source-files-and-separates-excluded-paths.json'
			},
			[
				{
					name: 'Git-ignored, sensitive, generated, configured and source files in one repository',
					input: {
						files: sourceFiles,
						gitignore: [gitIgnoredFiles.trim()],
						exclusions: configuredExclusions
					},
					output: coverage
				}
			]
		);
	});
});

test('Matches globs and directory prefix exclusions', () => {
	const outputs = matchCases.map(({ path, pattern, expected }) => {
		const output = matchesExclusion(path, pattern);
		expect(output).toBe(expected);
		return { name: `${pattern} vs ${path}`, input: { path, pattern }, output };
	});

	expect(outputs.map((item) => item.output)).toEqual(matchCases.map((item) => item.expected));

	recordExampleCases(
		{
			unitId: 'audit.clean-code-discovery',
			symbol: 'matchesExclusion',
			state: 'matches-globs-and-directory-prefix-exclusions',
			evidence: 'examples-cases',
			file: 'matches-globs-and-directory-prefix-exclusions.json'
		},
		outputs
	);
});

test('Throws ExpectedCliError when the Git ignore probe times out', async () => {
	await withTempDir('clean-code-timeout-', (directory) => {
		const executable = join(directory, 'git');
		writeFileSync(executable, '#!/bin/sh\nwhile :; do :; done\n');
		chmodSync(executable, 0o755);
		const previousPath = process.env.PATH;
		process.env.PATH = `${directory}:/usr/bin:/bin`;
		let error: unknown;
		try {
			discoverCleanCodeFiles(directory, { files: [], dirs: [], ignoredPaths: [] }, []);
		} catch (caught) {
			error = caught;
		} finally {
			if (previousPath === undefined) delete process.env.PATH;
			else process.env.PATH = previousPath;
		}
		expect(error).toBeInstanceOf(Error);
		const actual = error as Error & { name: string };
		expect(actual.name).toBe('ExpectedCliError');
		expect(actual.message).toBe('Cannot safely determine ignored files for clean code review.');
		recordExampleCases(
			{
				unitId: 'audit.clean-code-discovery',
				symbol: 'discoverCleanCodeFiles',
				state: 'throws-expectedclierror-when-the-git-ignore-probe-times-out',
				evidence: 'examples-cases',
				file: 'throws-expectedclierror-when-the-git-ignore-probe-times-out.json'
			},
			[
				{
					name: 'Git ignore probe exceeds its synchronous deadline',
					input: { files: [], ignoredPaths: [], exclusions: [] },
					error: { name: actual.name, message: actual.message }
				}
			]
		);
	});
});
