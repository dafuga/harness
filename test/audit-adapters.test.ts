import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { auditProject } from '../src/audit/audit';
import { adaptersForProfile, resolveAuditProfile } from '../src/audit/adapters/registry';

test('audit profiles select ecosystem adapters', () => {
	expect(adaptersForProfile('app').map((adapter) => adapter.id)).toEqual(['typescript', 'svelte', 'sql']);
	expect(adaptersForProfile('lib').map((adapter) => adapter.id)).toEqual([
		'typescript',
		'cpp',
		'python',
		'shell',
		'wasm'
	]);
});

test('auto profile detects Svelte apps and Frame libs', async () => {
	const root = await mkdtemp(join(tmpdir(), 'frame-profile-'));
	try {
		await writeFile(join(root, 'svelte.config.js'), 'export default {};\n');
		expect(resolveAuditProfile(root, 'auto')).toBe('app');
		await writeFile(join(root, 'package.json'), '{"frame":{"kind":"lib"}}\n');
		expect(resolveAuditProfile(root, 'auto')).toBe('lib');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('coverage reports covered, ignored, and unknown files', async () => {
	const root = await mkdtemp(join(tmpdir(), 'frame-coverage-'));
	try {
		await mkdir(join(root, 'src'));
		await mkdir(join(root, 'node_modules'));
		await writeFile(join(root, 'src/index.ts'), 'export const value = 1;\n');
		await writeFile(join(root, 'src/component.vue'), '<template />\n');
		await writeFile(join(root, 'node_modules/ignored.ts'), 'export const ignored = true;\n');

		const result = await auditProject(root, { profile: 'lib' });

		expect(result.coverage.coveredFiles).toContain('src/index.ts');
		expect(result.coverage.unknownFiles).toContain('src/component.vue');
		expect(result.coverage.ignoredPaths).toContain('node_modules/');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('ecosystem adapters report app and library rule violations', async () => {
	const root = await mkdtemp(join(tmpdir(), 'frame-ecosystems-'));
	try {
		await mkdir(join(root, 'db/migrations'), { recursive: true });
		await mkdir(join(root, 'src/components'), { recursive: true });
		await mkdir(join(root, 'scripts'), { recursive: true });
		await writeFile(join(root, 'db/migrations/drop_users.sql'), 'DROP TABLE users;\n');
		await writeFile(join(root, 'src/components/bad-name.svelte'), '<script>let count = 0;</script>\n');
		await writeFile(join(root, 'scripts/run.sh'), 'rm -rf $TARGET\n');

		const appRules = (await auditProject(root, { profile: 'app' })).findings.map((finding) => finding.rule);
		const libRules = (await auditProject(root, { profile: 'lib' })).findings.map((finding) => finding.rule);

		expect(appRules).toEqual(expect.arrayContaining(['sql-dangerous-migration', 'svelte-script-lang']));
		expect(libRules).toEqual(expect.arrayContaining(['shell-shebang', 'shell-strict-mode', 'shell-unsafe-rm']));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
