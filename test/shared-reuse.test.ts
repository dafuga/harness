import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Linter } from 'eslint';
import svelteParser from 'svelte-eslint-parser';
import tsParser from '@typescript-eslint/parser';
import { expect, test } from 'vitest';
import type { ReuseModule } from './shared-reuse.test.types';
import allowlist from '../eslint.reuse-allowlist.json';
import ceiling from '../eslint.reuse-baseline.json';

const root = resolve(import.meta.dirname, '..');
const reuse = (await import(join(root, 'eslint.reuse-rules.js'))) as ReuseModule;
const plugin = (await import(join(root, 'eslint.harness-rules.js'))) as {
	default: NonNullable<Linter.Config['plugins']>[string];
};
function lint(filename: string, code: string): string[] {
	const config: Linter.Config[] = [
		{
			files: ['**/*.svelte', '**/*.ts'],
			languageOptions: {
				parser: filename.endsWith('.svelte') ? svelteParser : tsParser,
				parserOptions: { parser: tsParser }
			},
			plugins: { harness: plugin.default },
			rules: { 'harness/shared-reuse': 'error' }
		}
	];
	return new Linter({ cwd: root })
		.verify(code, config, join(root, filename))
		.map((message) => message.message);
}

test('feature source must reuse shared markup and commit shortening', () => {
	expect(
		lint(
			'packages/reports/src/components/Unlisted.svelte',
			'<hx-figure class="ex-card-shot">Capture</hx-figure>'
		)
	).toEqual([]);
	for (const markup of [
		'<hx-article class="ex-card">Content</hx-article>',
		'<hx-span class="ex-pill">Ready</hx-span>',
		'<hx-span class="chip">Ready</hx-span>',
		'<hx-section class:ex-card={true}>Content</hx-section>',
		"<hx-p class={true ? 'empty' : 'content'}>No rows</hx-p>",
		'<hx-p class="empty">Nothing recorded</hx-p>',
		'<hx-p class="ex-notice">Partial reading</hx-p>',
		'<hx-table><hx-tbody /></hx-table>',
		'<hx-dl><hx-dt>Name</hx-dt><hx-dd>Daniel</hx-dd></hx-dl>'
	])
		expect(lint('packages/reports/src/components/Unlisted.svelte', markup)).toEqual([
			expect.stringContaining('Reuse the shared')
		]);
	for (const size of [7, 8, 10])
		expect(
			lint(
				'packages/desktop/src/utils/unlisted.ts',
				`const commit = 'abcdef'; commit.slice(0, ${size});`
			)
		).toEqual([expect.stringContaining('commit')]);
});

test('shared primitive implementation and unrelated collection or date slices stay admitted', () => {
	expect(
		lint('packages/reports/src/components/shared-primitives/Table.svelte', '<hx-table />')
	).toEqual([]);
	expect(
		lint(
			'packages/reports/src/helpers/strings/shortCommit.ts',
			'export const shortCommit = (commit: string) => commit.slice(0, 7);'
		)
	).toEqual([]);
	expect(
		lint(
			'packages/desktop/src/utils/unlisted.ts',
			'const rows = [1, 2]; rows.slice(0, 8); const createdAt = "2026-11-01"; createdAt.slice(0, 10);'
		)
	).toEqual([]);
});

function sources(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return sources(path);
		return /\.(ts|svelte)$/.test(path) ? [path] : [];
	});
}

test('the frozen reuse allowlist only shrinks and exactly describes remaining source debt', () => {
	expect(
		createHash('sha256')
			.update(readFileSync(join(root, 'eslint.reuse-baseline.json')))
			.digest('hex')
	).toBe('7842adf54e62376ba038ca8aa310e95c0457ed0c092723e913c3a1b28bd93aa0');
	expect(reuse.reuseAllowlistGaps(allowlist, ceiling)).toEqual([]);
	assertAllowlistHistory();
	const current: Record<string, number> = {};
	for (const area of ['src', 'packages/reports/src', 'packages/desktop/src', 'packages/hub/src'])
		for (const file of sources(join(root, area)))
			for (const finding of reuse.reuseFindings(file, readFileSync(file, 'utf8'))) {
				const key = file.slice(root.length + 1) + '#' + finding.kind;
				current[key] = (current[key] ?? 0) + 1;
			}
	expect(current).toEqual(allowlist);
});

test('allowlist admission rejects new entries and increases while admitting removals', () => {
	expect(reuse.reuseAllowlistGaps({ known: 2, new: 1 }, { known: 1 })).toEqual(['known', 'new']);
	expect(reuse.reuseAllowlistGaps({ known: 1 }, { known: 2, removed: 1 })).toEqual([]);
	expect(reuse.reuseAllowlistGaps({ known: 0 }, { known: 1 })).toEqual(['known']);
});

/** Compare every committed version, so the original ceiling cannot permit debt to grow back. */
function assertAllowlistHistory(): void {
	const versions = execFileSync(
		'git',
		['log', '--first-parent', '--format=%H', 'HEAD', '--', 'eslint.reuse-allowlist.json'],
		{ cwd: root, encoding: 'utf8' }
	)
		.trim()
		.split('\n')
		.filter(Boolean);
	let newer: Record<string, number> = allowlist;
	for (const commit of versions) {
		const older = JSON.parse(
			execFileSync('git', ['show', commit + ':eslint.reuse-allowlist.json'], {
				cwd: root,
				encoding: 'utf8'
			})
		) as Record<string, number>;
		expect(
			reuse.reuseAllowlistGaps(newer, older),
			'Shared reuse debt cannot grow beyond ' + commit
		).toEqual([]);
		newer = older;
	}
}
