import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from 'vitest';
import { trackerAreaInventory } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerAreaInventory';
import { withTempDir } from '../../support/temporary';

test('the launcher combines declared modules, tracked names and old and new paths from linked PRs', async () => {
	await withTempDir('hnt-area-', async (root) => {
		const route = fixtureRoute(root);
		const { repo } = route;
		const inspect = (text: string) =>
			trackerAreaInventory(route, text, new AbortController().signal);
		const declared = await inspect(
			'Repair existing and https://github.com/fixture/project/pull/41\nAreas: src/extra'
		);
		expect(declared.repo).toBe('fixture/project');
		expect(declared.areas.sort()).toEqual([
			'existing.ts',
			'new/file.ts',
			'old/file.ts',
			'src/extra'
		]);
		expect(declared.siblings.map((p) => p.number)).toEqual([41]);
		expect((await inspect('Areas: old')).siblings.map((p) => p.number)).toEqual([41]);
		expect((await inspect('Unspecified maintenance')).siblings.map((p) => p.number)).toEqual([
			41, 42
		]);
		await expect(
			trackerAreaInventory({ repo, platform: 'macos' }, 'unknown', new AbortController().signal)
		).rejects.toThrow('GitHub read binding');
	});
});

function fixtureRoute(root: string) {
	const repo = join(root, 'repo'),
		config = join(root, 'gh'),
		executable = join(root, 'github-reader');
	mkdirSync(repo);
	mkdirSync(config, { mode: 0o700 });
	const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', repo, ...args]);
	git('init', '-q');
	git('remote', 'add', 'origin', 'https://github.com/fixture/project.git');
	writeFileSync(join(repo, 'existing.ts'), 'module');
	git('add', 'existing.ts');
	const changed = {
		number: 41,
		author: { login: 'owner' },
		headRefName: 'move',
		headRefOid: 'a'.repeat(40),
		baseRefName: 'main',
		changedFiles: 1,
		files: [{ path: 'new/file.ts', changeType: 'RENAMED' }]
	};
	const unrelated = {
		...changed,
		number: 42,
		files: [{ path: 'different.ts', changeType: 'MODIFIED' }]
	};
	const output = JSON.stringify([changed, unrelated]);
	const rename = JSON.stringify([[{ filename: 'new/file.ts', previous_filename: 'old/file.ts' }]]);
	writeFileSync(
		executable,
		`#!/bin/sh\ncase "$1" in\npr) echo '${output}';;\napi) echo '${rename}';;\n*) exit 1;;\nesac\n`,
		{ mode: 0o700 }
	);
	return {
		repo,
		platform: 'macos' as const,
		github: { executable, configDirectory: config }
	};
}
