import { expect, test } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import type { SourceTree } from '../../../src/core/development-tooling/sourceTypes';
import { projectDependencies } from '../../../src/services/explorer-ui/revision-detail-service/projectDependencies';

const snapshot = (files: Record<string, string>): SourceTree => ({
	revision: 'fixture',
	list: async () => Object.keys(files).map((path) => ({ path, hash: 'fixture' })),
	read: async (path) => {
		if (!(path in files)) throw Error('Missing fixture');
		return files[path];
	}
});
const json = (data: unknown) => JSON.stringify(data);

test('project package catalog preserves declared versions, workspace origins and dependency kinds', async () => {
	const tree = snapshot({
		'package.json': json({
			name: 'workspace-root',
			workspaces: ['packages/*'],
			dependencies: { zod: '^3.0.0' },
			devDependencies: { vitest: '^4.0.0' },
			scripts: { prepare: 'throw new Error()' }
		}),
		'packages/app/package.json': json({
			name: 'app',
			dependencies: { zod: '^4.0.0' },
			peerDependencies: { react: '^19' },
			optionalDependencies: { fsevents: '2' }
		}),
		'test/fixtures/package.json': json({ dependencies: { 'fixture-only': '*' } }),
		'node_modules/hidden/package.json': json({ dependencies: { 'installed-only': '*' } })
	});
	const result = await measureWorkload(
		'service.revision-detail',
		'read-project-package-declarations',
		() => projectDependencies(tree)
	);
	expect(result.gaps).toEqual([]);
	expect(result.entries).toEqual(
		expect.arrayContaining([
			{
				name: 'zod',
				version: '^3.0.0',
				kind: 'runtime',
				ecosystem: 'npm',
				workspace: 'workspace-root',
				source: 'package.json'
			},
			{
				name: 'zod',
				version: '^4.0.0',
				kind: 'runtime',
				ecosystem: 'npm',
				workspace: 'app',
				source: 'packages/app/package.json'
			},
			{
				name: 'vitest',
				version: '^4.0.0',
				kind: 'development',
				ecosystem: 'npm',
				workspace: 'workspace-root',
				source: 'package.json'
			},
			{
				name: 'react',
				version: '^19',
				kind: 'peer',
				ecosystem: 'npm',
				workspace: 'app',
				source: 'packages/app/package.json'
			},
			{
				name: 'fsevents',
				version: '2',
				kind: 'optional',
				ecosystem: 'npm',
				workspace: 'app',
				source: 'packages/app/package.json'
			}
		])
	);
	expect(result.entries).toHaveLength(5);
});

test('Cargo dependency declarations include workspace inheritance and build/dev dependencies', async () => {
	const tree = snapshot({
		'Cargo.toml': '[workspace]\nmembers=["crates/*"]\n[workspace.dependencies]\nserde="1"',
		'crates/core/Cargo.toml':
			'[package]\nname="core"\n[dependencies]\nserde={workspace=true}\nserde_json="1"\n[dev-dependencies]\npretty_assertions="1"\n[build-dependencies]\ncc="1"'
	});
	const result = await projectDependencies(tree);
	expect(result.gaps).toEqual([]);
	expect(
		result.entries.map(({ name, version, kind, ecosystem, workspace }) => ({
			name,
			version,
			kind,
			ecosystem,
			workspace
		}))
	).toEqual(
		expect.arrayContaining([
			{ name: 'serde', version: '1', kind: 'runtime', ecosystem: 'cargo', workspace: 'core' },
			{ name: 'serde_json', version: '1', kind: 'runtime', ecosystem: 'cargo', workspace: 'core' },
			{
				name: 'pretty_assertions',
				version: '1',
				kind: 'development',
				ecosystem: 'cargo',
				workspace: 'core'
			},
			{ name: 'cc', version: '1', kind: 'build', ecosystem: 'cargo', workspace: 'core' }
		])
	);
});

test('missing and malformed declarations stay explicit without substituting installed packages', async () => {
	expect((await projectDependencies(snapshot({}))).gaps).toContain(
		'No package manifests are recorded at this revision.'
	);
	const result = await projectDependencies(snapshot({ 'package.json': '{broken' }));
	expect(result.entries).toEqual([]);
	expect(result.gaps.join(' ')).toContain('package.json');
});
