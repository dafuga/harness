import type { Cases } from './module.history.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { lfsPointer, lfsStored } from '../../src/utils/verification-evidence/lfsPointer';
import { refKind, sourceArchiveRef } from '../../src/utils/git-source-history/historyRefs';

const shot = { sha256: 'a'.repeat(64), bytes: 2048 };

function record(state: string, symbol: string, cases: Cases): void {
	recordExampleCases(
		{
			unitId: 'module.history',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Builds the Git LFS pointer text for a media object', () => {
	const pointer = lfsPointer(shot);
	expect(pointer).toBe(
		`version https://git-lfs.github.com/spec/v1\noid sha256:${shot.sha256}\nsize 2048\n`
	);
	record('builds-the-git-lfs-pointer-text-for-a-media-object', 'lfsPointer', [
		{ name: 'screenshot with 2048 bytes', input: shot, output: pointer }
	]);
});

test('Recognises media extensions as LFS-stored paths', () => {
	const shotPath = 'shots/home.PNG';
	const notePath = 'notes/readme.md';
	const clipPath = 'clip.mp4';
	expect(lfsStored(shotPath)).toBe(true);
	expect(lfsStored(notePath)).toBe(false);
	expect(lfsStored(clipPath)).toBe(true);
	record('recognises-media-extensions-as-lfs-stored-paths', 'lfsStored', [
		{ name: 'uppercase png screenshot', input: shotPath, output: true },
		{ name: 'markdown note stays a blob', input: notePath, output: false },
		{ name: 'mp4 clip', input: clipPath, output: true }
	]);
});

test('Classifies refs by the prefix they live under', () => {
	const cases: Array<[string, string]> = [
		['refs/heads/main', 'source'],
		['refs/tags/v1.0.0', 'tag'],
		['refs/notes/commits', 'notes'],
		['refs/unknown/x', 'other']
	];
	for (const [ref, kind] of cases) {
		expect(refKind(ref)).toBe(kind);
	}
	record('classifies-refs-by-the-prefix-they-live-under', 'refKind', [
		{ name: 'branch is source', input: cases[0][0], output: cases[0][1] },
		{ name: 'tag is tag', input: cases[1][0], output: cases[1][1] },
		{ name: 'notes ref is notes', input: cases[2][0], output: cases[2][1] },
		{ name: 'unknown prefix is other', input: cases[3][0], output: cases[3][1] }
	]);
});

test('Builds the source archive ref for a tested commit', () => {
	const commit = 'abc123def456';
	const archive = sourceArchiveRef(commit);
	expect(archive.endsWith(commit)).toBe(true);
	expect(refKind(archive)).toBe('archive');
	record('builds-the-source-archive-ref-for-a-tested-commit', 'sourceArchiveRef', [
		{ name: 'archive ref keeps the commit', input: commit, output: archive }
	]);
});
