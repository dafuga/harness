import { expect, test } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { GitAdapter } from '../../../src/adapters/GitAdapter';
import { RevisionDetailService } from '../../../src/services/explorer-ui/revision-detail-service/RevisionDetailService';
import { HistoryStatusService } from '../../../src/services/verification-evidence/history-status-service/HistoryStatusService';

async function snapshot(files: Record<string, string>) {
	const root = await mkdtemp(join(tmpdir(), 'harness-package-catalog-'));
	const git = new GitAdapter(root);
	try {
		await git.run(['init', '-q', '-b', 'main']);
		await git.run(['config', 'user.name', 'Fixture']);
		await git.run(['config', 'user.email', 'fixture@harness.invalid']);
		for (const [path, text] of Object.entries(files)) {
			await mkdir(dirname(join(root, path)), { recursive: true });
			await writeFile(join(root, path), text);
		}
		await git.run(['add', '.']);
		await git.run(['commit', '--allow-empty', '-qm', 'chore: record package declarations']);
		const commit = await git.run(['rev-parse', 'HEAD']);
		await writeFile(
			join(root, 'package.json'),
			JSON.stringify({ dependencies: { 'wrong-working-copy': '*' } })
		);
		const { detail } = await measureWorkload(
			'service.revision-detail',
			'read-project-package-declarations',
			() =>
				new RevisionDetailService(root, new HistoryStatusService(root)).build(commit, {
					place: async () => ({ media: null, gap: 'Fixture has no captures' })
				})
		);
		expect(
			Object.hasOwn(detail, 'projectDependencies'),
			'Revision detail publishes package catalog'
		).toBe(true);
		const catalog = (
			detail as unknown as {
				projectDependencies?: {
					entries: Array<{
						name: string;
						version: string;
						kind: string;
						ecosystem: string;
						workspace: string;
						source: string;
					}>;
					gaps: string[];
				};
			}
		).projectDependencies;
		expect(catalog, 'Selected revision retains its package declarations').toBeDefined();
		return catalog!;
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}
const json = (data: unknown) => JSON.stringify(data);

test('project package catalog preserves declared versions, workspace origins and dependency kinds', async () => {
	const tree = {
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
	};
	const result = await snapshot(tree);
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
	const tree = {
		'Cargo.toml': '[workspace]\nmembers=["crates/*"]\n[workspace.dependencies]\nserde="1"',
		'crates/core/Cargo.toml':
			'[package]\nname="core"\n[dependencies]\nserde={workspace=true}\nserde_json="1"\n[dev-dependencies]\npretty_assertions="1"\n[build-dependencies]\ncc="1"'
	};
	const result = await snapshot(tree);
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
	expect((await snapshot({})).gaps).toContain(
		'No package manifests are recorded at this revision.'
	);
	const result = await snapshot({ 'package.json': '{broken' });
	expect(result.entries).toEqual([]);
	expect(result.gaps.join(' ')).toContain('package.json');
});
