import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runCommand } from './support/cli';

const consumer = `
import {
	evidenceBranch,
	evidenceManifestSchema,
	historyIndexSchema,
	historyNoteSchema,
	lfsPointer,
	mergeNoteLines,
	notesRef,
	parseLfsPointer,
	readNoteLines,
	refKind,
	sourceArchiveRef,
	type EvidenceManifest,
	type HistoryIndex,
	type HistoryNote
} from '@dafuga01/harness/history';

const commit = 'a'.repeat(40);
const note: HistoryNote = historyNoteSchema.parse({
	schemaVersion: 1,
	kind: 'verification',
	record: 'r1',
	status: 'failed',
	profile: 'p1',
	finishedAt: '2026-10-10T00:00:00.000Z',
	source: { commit, tree: 'b'.repeat(40), base: null },
	evidence: { commit: 'c'.repeat(40), path: 'records/' + commit + '/r1', manifest: 'd'.repeat(64) }
});
const manifest: EvidenceManifest | undefined = evidenceManifestSchema.safeParse({}).data;
const index: HistoryIndex | undefined = historyIndexSchema.safeParse({ schemaVersion: 1 }).data;
const line = JSON.stringify(note);
const pointer = lfsPointer({ sha256: 'e'.repeat(64), bytes: 7 });
console.log(JSON.stringify({
	refs: [evidenceBranch, notesRef, sourceArchiveRef(commit), refKind('refs/heads/' + evidenceBranch), refKind('refs/heads/main')],
	merged: mergeNoteLines(line + '\\n', line + '\\n').trim().split('\\n').length,
	read: readNoteLines(line + '\\nnope\\n', commit).problems,
	copied: readNoteLines(line + '\\n', 'f'.repeat(40)).entries.length,
	pointer: parseLfsPointer(pointer),
	parsed: [manifest === undefined, index === undefined, note.kind]
}));
`;

test('a packed consumer uses the history contracts without Git or the CLI', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-history-api-'));
	const tarball = join(root, 'harness.tgz');
	await runCommand(['bun', 'pm', 'pack', '--ignore-scripts', '--filename', tarball], process.cwd());
	const project = join(root, 'consumer');
	await mkdir(project);
	const manifest = {
		name: 'consumer',
		private: true,
		type: 'module',
		dependencies: { '@dafuga01/harness': `file:${tarball}` },
		devDependencies: { typescript: '^5.8.3', '@types/node': '^22.15.3' }
	};
	const compilerOptions = {
		target: 'ES2022',
		module: 'ESNext',
		moduleResolution: 'Bundler',
		strict: true,
		noEmit: true,
		types: ['node']
	};
	await writeFile(join(project, 'package.json'), JSON.stringify(manifest));
	await writeFile(
		join(project, 'tsconfig.json'),
		JSON.stringify({ compilerOptions, include: ['consumer.ts'] })
	);
	await writeFile(join(project, 'consumer.ts'), consumer);
	await runCommand(['bun', 'install'], project);
	const typecheck = await runCommand(['bun', 'x', 'tsc', '-p', '.'], project, false);
	expect(typecheck.stdout + typecheck.stderr).toBe('');
	const run = await runCommand(['bun', 'consumer.ts'], project);
	expect(JSON.parse(run.stdout)).toEqual({
		refs: [
			'harness-evidence',
			'refs/notes/harness',
			`refs/harness/source/${'a'.repeat(40)}`,
			'evidence',
			'source'
		],
		merged: 1,
		read: ['note line 2 is not a valid history entry'],
		copied: 0,
		pointer: { sha256: 'e'.repeat(64), bytes: 7 },
		parsed: [true, true, 'verification']
	});
	await rm(root, { recursive: true, force: true });
}, 240_000);
