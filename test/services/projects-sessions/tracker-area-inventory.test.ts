import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, expect } from 'vitest';
import { trackerAreaInventory } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerAreaInventory';
import { areaCheckout, withOpenPulls } from '../../support/trackerAreaFixture';
import { withTempDir } from '../../support/temporary';

const signal = () => new AbortController().signal;

test('the launcher separates declared paths from tracked names and linked pull request paths', async () => {
	await withTempDir('hnt-area-', async (root) => {
		const unbound = areaCheckout(root, ['existing.ts']);
		const route = withOpenPulls(root, unbound);
		const inspect = (text: string) => trackerAreaInventory(route, text, signal());
		const declared = await inspect(
			'Repair existing and https://github.com/fixture/project/pull/41\nAreas: src/extra'
		);
		expect(declared.repo).toBe('fixture/project');
		expect(declared.areas).toEqual(['src/extra']);
		expect([...declared.inferred].sort()).toEqual(['existing.ts', 'new/file.ts', 'old/file.ts']);
		expect(declared.siblings.map((p) => p.number)).toEqual([41]);
		expect((await inspect('Areas: old')).siblings.map((p) => p.number)).toEqual([41]);
		const unknown = await inspect('Unspecified maintenance');
		expect(unknown).toMatchObject({ areas: [], inferred: [], siblings: [] });
		expect(unknown.warnings.join(' ')).toContain('open pull requests were not compared');
		const blind = await trackerAreaInventory(unbound, 'Areas: src/extra', signal());
		expect(blind).toMatchObject({ repo: 'fixture/project', areas: ['src/extra'], siblings: [] });
		expect(blind.warnings.join(' ')).toContain('No GitHub read binding');
	});
});

test('a failing reader and an unrecognised remote keep the declared paths', async () => {
	await withTempDir('hnt-area-fail-', async (root) => {
		const route = areaCheckout(root);
		const configDirectory = join(root, 'gh');
		const executable = join(root, 'github-reader');
		mkdirSync(configDirectory, { mode: 0o700 });
		writeFileSync(executable, '#!/bin/sh\nexit 1\n', { mode: 0o700 });
		const broken = await trackerAreaInventory(
			{ ...route, github: { executable, configDirectory } },
			'Areas: docs',
			signal()
		);
		expect(broken.areas).toEqual(['docs']);
		expect(broken.warnings.join(' ')).toContain('Open pull requests could not be read');
		execFileSync('/usr/bin/git', [
			'-C',
			route.repo,
			'remote',
			'set-url',
			'origin',
			'ssh://git.example.invalid/project.git'
		]);
		const other = await trackerAreaInventory(route, 'Areas: docs', signal(), {
			project: 'Harness'
		});
		expect(other).toMatchObject({ repo: 'workspace/harness', areas: ['docs'] });
		expect(other.warnings.join(' ')).toContain('not a recognised GitHub remote');
	});
});
