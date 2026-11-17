import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { ConsoleChangeService, replacedDirectory } from '../../src/services/projects-sessions/ConsoleChangeService';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const manifest = () => ({ schemaVersion: 1 as const, files: [], changes: [] });

test('Classifies whether a console write is safe', async () => {
	await withTempDir('console-change-state-', async (host) => {
		await mkdir(join(host, 'src'), { recursive: true });
		await writeFile(join(host, 'src/console.ts'), 'local edit');
		const service = new ConsoleChangeService(host, {
			...manifest(),
			files: [{ path: 'src/console.ts', sha256: hash('installed'), owner: 'harness' }]
		});
		const conflict = await service.state('src/console.ts', 'new content');
		const free = await service.state('src/missing.ts', 'new content');
		expect(conflict).toEqual({ kind: 'conflict', reason: 'edited since it was installed' });
		expect(free).toEqual({ kind: 'free' });
		recordExampleCases(
			{ unitId: 'service.console-change', symbol: 'state', state: 'classifies-whether-a-console-write-is-safe', evidence: 'examples-cases', file: 'classifies-whether-a-console-write-is-safe.json' },
			[
				{ name: 'edited harness file conflicts', input: { path: 'src/console.ts', contents: 'new content' }, output: conflict },
				{ name: 'missing file is free', input: { path: 'src/missing.ts', contents: 'new content' }, output: free }
			]
		);
	});
});

test('Saves replacements and restores the latest saved bytes', async () => {
	await withTempDir('console-change-restore-', async (host) => {
		const path = 'src/console.ts';
		const saved = `${replacedDirectory}/${hash('original')}`;
		await mkdir(join(host, replacedDirectory), { recursive: true });
		await mkdir(join(host, 'src'), { recursive: true });
		await writeFile(join(host, saved), 'original');
		await writeFile(join(host, path), 'installed');
		const prior = { path, action: 'replaced' as const, reason: 'install update', at: '2026-11-14T09:30:00.000Z', before: { sha256: hash('original'), bytes: 8, saved }, after: { sha256: hash('installed'), bytes: 9 } };
		const service = new ConsoleChangeService(host, { ...manifest(), changes: [prior] });
		const change = await service.replace(path, 'next', { action: 'replaced', reason: 'console install updated the existing file' });
		const restored = await service.restore(path);
		expect(change.after).toEqual({ sha256: hash('next'), bytes: 4 });
		expect(restored?.action).toBe('restored');
		expect(await readFile(join(host, path), 'utf8')).toBe('original');
		recordExampleCases(
			{ unitId: 'service.console-change', symbol: 'replace and restore', state: 'saves-replacements-and-restores-the-latest-saved-bytes', evidence: 'examples-cases', file: 'saves-replacements-and-restores-the-latest-saved-bytes.json' },
			[
				{ name: 'replace records before and after identity', input: { path, contents: 'next', action: 'replaced', reason: 'console install updated the existing file' }, output: { path: change.path, action: change.action, reason: change.reason, before: change.before, after: change.after } },
				{ name: 'restore writes the latest saved content', input: { path }, output: { action: restored?.action, after: restored?.after, content: await readFile(join(host, path), 'utf8') } }
			]
		);
	});
});

test('Writes and removes files while recording their owner', async () => {
	await withTempDir('console-change-files-', async (host) => {
		const service = new ConsoleChangeService(host, manifest());
		const path = 'src/generated/console.ts';
		await service.write(path, 'export const enabled = true;\n');
		const entry = await service.entryFor(path, 'harness');
		await service.remove(path);
		const missingEntry = await service.entryFor(path, 'host');
		expect(entry.sha256).toBe(hash('export const enabled = true;\n'));
		expect(missingEntry.sha256).toBe(hash(''));
		recordExampleCases(
			{ unitId: 'service.console-change', symbol: 'write remove entryFor', state: 'writes-and-removes-files-while-recording-their-owner', evidence: 'examples-cases', file: 'writes-and-removes-files-while-recording-their-owner.json' },
			[
				{ name: 'written file receives harness entry', input: { path, contents: 'export const enabled = true;\n', owner: 'harness' }, output: entry },
				{ name: 'removed file hashes as empty bytes', input: { path, owner: 'host' }, output: missingEntry }
			]
		);
	});
});

test('Throws Error when replacement storage cannot be created', async () => {
	await withTempDir('console-change-error-', async (host) => {
		await writeFile(join(host, '.harness'), 'not a directory');
		const service = new ConsoleChangeService(host, manifest());
		const operation = service.replace('src/console.ts', 'replacement', {
			action: 'replaced',
			reason: 'console install updated the existing file'
		});
		await expect(operation).rejects.toMatchObject({ code: 'ENOTDIR' });
		recordExampleCases(
			{ unitId: 'service.console-change', symbol: 'replace', state: 'throws-error-when-replacement-storage-cannot-be-created', evidence: 'examples-cases', file: 'throws-error-when-replacement-storage-cannot-be-created.json' },
			[
				{
					name: 'replacement storage parent is a file',
					input: { path: 'src/console.ts', contents: 'replacement', action: 'replaced' },
					error: { name: 'Error', code: 'ENOTDIR' }
				}
			]
		);
	});
});
