import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { measureWorkload } from '../support/measureWorkload';
import { CommitTreeAdapter } from '../../src/adapters/CommitTreeAdapter';
import { GitAdapter } from '../../src/adapters/GitAdapter';
import type { SourceTree } from '../../src/core/development-tooling/sourceTypes';
import { readPlatformCatalog } from '../../src/services/explorer-ui/revision-detail-service/platformCatalog';
import { HistoryIndexService } from '../../src/cli/program/history-index-service/HistoryIndexService';

const web = {
	id: 'web',
	runtime: 'SvelteKit',
	status: 'configured',
	summary: 'Browser client.',
	configuration: [{ name: 'Project', value: 'orders-web' }],
	commands: [{ name: 'Build', command: 'bun run build:web' }],
	requirements: [],
	sources: ['wrangler.jsonc']
};
const manifest = (platforms = [web]) => JSON.stringify({ schemaVersion: 1, platforms });
const snapshot = (source?: string): SourceTree => ({
	revision: 'test',
	list: async () =>
		source === undefined ? [] : [{ path: 'harness.platforms.json', hash: 'test' }],
	read: async () => source ?? ''
});

test('platform configuration exposes declared values and explicitly reports missing declarations', async () => {
	expect(
		await measureWorkload(
			'service.explorer-ui-revision-detail-service-platform-catalog',
			'read-platform-manifest',
			() =>
				measureWorkload(
					'function.explorer-ui-platform-types',
					'validate-platform-identities-through-reader',
					() => readPlatformCatalog(snapshot(manifest()))
				)
		)
	).toEqual({ entries: [web] });
	expect(await readPlatformCatalog(snapshot())).toEqual({
		entries: [],
		gap: 'No platform configuration is recorded at this revision.'
	});
});

test.each(
	[
		'{invalid json',
		manifest([web, web]),
		manifest([{ ...web, status: 'not-configured' }]),
		manifest([{ ...web, sources: ['../secret.txt'] }]),
		manifest([{ ...web, sources: ['https://example.com/config'] }]),
		manifest([{ ...web, id: 'unknown' }]),
		JSON.stringify({ schemaVersion: 2, platforms: [web] }),
		' '.repeat(131073)
	].map((source, index) => [index, source] as const)
)('invalid configuration case %i offers no command', async (_index, source) => {
	const result = await readPlatformCatalog(snapshot(source));
	expect(result.entries).toEqual([]);
	expect(result.gap).toContain('could not be read at this revision');
});

test('a target can explicitly record that it has no deployment configuration', async () => {
	const android = {
		...web,
		id: 'android',
		status: 'not-configured',
		commands: [],
		configuration: []
	};
	expect(await readPlatformCatalog(snapshot(manifest([android])))).toEqual({ entries: [android] });
});

test('configuration is read from the selected Git commit, including commits before it existed', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-platform-history-'));
	const git = new GitAdapter(root);
	try {
		await git.run(['init', '-b', 'main']);
		await git.run(['config', 'user.name', 'Synthetic']);
		await git.run(['config', 'user.email', 'synthetic@example.invalid']);
		await git.run(['commit', '--allow-empty', '-m', 'chore: start fixture']);
		const missing = await git.run(['rev-parse', 'HEAD']);
		await writeFile(join(root, 'harness.platforms.json'), manifest());
		await git.run(['add', '.']);
		await git.run(['commit', '-m', 'feat: configure web']);
		const configured = await git.run(['rev-parse', 'HEAD']);
		await writeFile(
			join(root, 'harness.platforms.json'),
			manifest([{ ...web, runtime: 'Changed runtime' }])
		);
		await git.run(['commit', '-am', 'chore: change runtime']);
		const selected = await readPlatformCatalog(await CommitTreeAdapter.open(root, configured));
		expect(selected.entries[0].runtime).toBe('SvelteKit');
		expect(
			(await readPlatformCatalog(await CommitTreeAdapter.open(root, missing))).entries
		).toEqual([]);
		const output = join(root, '.cache/history');
		await measureWorkload('service.revision-detail', 'read-platform-revisions-from-git', () =>
			new HistoryIndexService(root).build(output, 10, async () => [])
		);
		const saved = JSON.parse(await readFile(join(output, `revisions/${configured}.json`), 'utf8'));
		expect(saved.platforms.entries[0].runtime).toBe('SvelteKit');
		const older = JSON.parse(await readFile(join(output, `revisions/${missing}.json`), 'utf8'));
		expect(older.platforms).toMatchObject({
			entries: [],
			gap: expect.stringContaining('No platform configuration')
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
