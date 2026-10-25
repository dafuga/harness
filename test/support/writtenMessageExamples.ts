import { expect } from 'vitest';
import type {
	CommitMessageFixture,
	CommitMessageImplementations
} from './commitMessageExamples.types';
import {
	expectCommit,
	expectWritten,
	messageProjection,
	cleaned,
	cut,
	diff
} from './commitMessageAssertions';
export function writtenGitDrops(implementations: CommitMessageImplementations): string {
	const file = [
		'feat: add the navbar',
		'',
		'Why it was needed.',
		'# Please enter the commit message for your changes. Lines starting',
		"# with '#' will be ignored, and an empty message aborts the commit.",
		'# ------------------------ >8 ------------------------',
		'# Do not modify or remove the line above.',
		'diff --git a/file b/file',
		`+${'x'.repeat(900)}`
	].join('\n');
	const first = expectWritten(
		implementations,
		file,
		{},
		'feat: add the navbar\n\nWhy it was needed.'
	);
	expectCommit(implementations, first, []);
	expectWritten(
		implementations,
		'fix: a\n\n# kept\n; dropped',
		{ comment: ';' },
		'fix: a\n\n# kept'
	);
	for (const cleanup of ['whitespace', 'verbatim'])
		expectWritten(implementations, 'fix: a\n\n# kept', { cleanup }, 'fix: a\n\n# kept');
	const tail = file.split('\n').slice(5).join('\n');
	expectWritten(
		implementations,
		`fix: a\n\n# kept\n${tail}`,
		{ cleanup: 'scissors' },
		'fix: a\n\n# kept'
	);
	return first;
}
export function writtenCleanup(implementations: CommitMessageImplementations): string {
	const padded = `feat: parity\n\nalpha${' '.repeat(410)}\nbeta\n`;
	for (const cleanup of cleaned) {
		const actual = expectWritten(
			implementations,
			padded,
			{ cleanup },
			'feat: parity\n\nalpha\nbeta'
		);
		const problems = expectCommit(implementations, actual, []);
		expect([cleanup, actual, problems]).toEqual([cleanup, 'feat: parity\n\nalpha\nbeta', []]);
	}
	const untidy = '\n \n\t\nfeat: tidy \t\r\n\n\n  \n  indented stays \n\n\n\nlast\r\n\n \n';
	for (const cleanup of cleaned) {
		const actual = expectWritten(
			implementations,
			untidy,
			{ cleanup },
			'feat: tidy\n\n  indented stays\n\nlast'
		);
		expect([cleanup, actual]).toEqual([cleanup, 'feat: tidy\n\n  indented stays\n\nlast']);
	}
	expectWritten(implementations, 'fix: a \n# gone\nb\n\n# gone\n\nc\n', {}, 'fix: a\nb\n\nc');
	const odd = 'fix: a\n\nb\u00a0\nc\f\nd\n';
	return expectWritten(
		implementations,
		odd,
		{ cleanup: 'whitespace' },
		'fix: a\n\nb\u00a0\nc\f\nd'
	);
}
export function writtenVerbatim(implementations: CommitMessageImplementations) {
	const padded = `feat: parity\n\nalpha${' '.repeat(410)}\nbeta\n`;
	const actual = expectWritten(implementations, padded, { cleanup: 'verbatim' }, padded.trim());
	expectCommit(implementations, actual, ['body has 420 characters; the limit is 400.']);
	expectWritten(
		implementations,
		'fix: a\n\n\n# kept  \n\n\nb',
		{ cleanup: 'verbatim' },
		'fix: a\n\n\n# kept  \n\n\nb'
	);
	return messageProjection(actual);
}
export function writtenScissors(implementations: CommitMessageImplementations): string {
	const first = `fix: a\n\nwhy  \n${cut}\n${diff}`;
	const result = expectWritten(implementations, first, { cleanup: 'scissors' }, 'fix: a\n\nwhy');
	for (const cleanup of cleaned) {
		const actual = expectWritten(implementations, first, { cleanup }, 'fix: a\n\nwhy');
		expect([cleanup, actual]).toEqual([cleanup, 'fix: a\n\nwhy']);
	}
	expectWritten(implementations, `${cut}\n${diff}`, { cleanup: 'scissors' }, '');
	const near = `fix: a\n\n${cut} more\nkept  \n`;
	expectWritten(implementations, near, {}, 'fix: a\n\nkept');
	expectWritten(implementations, near, { cleanup: 'scissors' }, `fix: a\n\n${cut} more\nkept`);
	const other = `fix: a\n\n; gone\n# kept\n;${cut.slice(1)}\n${diff}`;
	expectWritten(implementations, other, { comment: ';' }, 'fix: a\n\n# kept');
	expectWritten(
		implementations,
		`fix: a\n\n${cut}\nkept\n`,
		{ comment: ';' },
		`fix: a\n\n${cut}\nkept`
	);
	return result;
}
export function writtenLongSpaces(
	implementations: CommitMessageImplementations,
	fixture: CommitMessageFixture
) {
	const spaces = fixture.spaces ?? 200_000;
	expect(spaces).toBe(200_000);
	const run = ' '.repeat(spaces);
	const started = performance.now();
	const actual = implementations.publicWrittenMessage(`fix: a\n\nb${run}c${run}\n`, {
		cleanup: 'whitespace'
	});
	expect(actual).toBe(`fix: a\n\nb${run}c`);
	expect(
		implementations.ownerWrittenMessage(`fix: a\n\nb${run}c${run}\n`, { cleanup: 'whitespace' })
	).toBe(actual);
	expect(performance.now() - started).toBeLessThan(2_000);
	return messageProjection(actual);
}
