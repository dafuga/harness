import { expect, test } from 'vitest';
import { EventEmitter } from 'node:events';
import type { BrowserContext } from '@playwright/test';
import { browserErrorCollector } from './support/browserTest';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectFiles } from '../src/templates/project';
import { pieceFiles } from '../src/templates/pieces';
import { findGuide } from '../src/guides/guide';
import { generatePiece } from '../src/workflows/generate-code/generateCode';

for (const kind of ['console', 'pageerror'] as const) {
	test(`${kind} diagnostics cover early and available pages once`, async () => {
		const context = Object.assign(new EventEmitter(), { pages: () => [] });
		const page = Object.assign(new EventEmitter(), { url: () => 'https://popup.test/' });
		const collector = browserErrorCollector();
		collector.watch(context as unknown as BrowserContext);
		collector.watch(context as unknown as BrowserContext);
		const emit = (message: string) => {
			if (kind === 'console') {
				const event = {
					type: () => 'error',
					text: () => message,
					page: () => page,
					location: () => ({ url: page.url(), lineNumber: 0, columnNumber: 0 })
				};
				context.emit('console', event);
				page.emit('console', event);
			} else {
				const error = new Error(message);
				context.emit('weberror', { page: () => page, error: () => error });
				page.emit('pageerror', error);
			}
		};
		emit('initial document failed');
		context.emit('page', page);
		emit('later script failed');
		let diagnostic: { errors: { message: string; page: string }[] } | undefined;
		await expect(
			collector.finish({
				attach: async (_name, entry) => {
					diagnostic = JSON.parse(String(entry?.body));
				}
			})
		).rejects.toThrow('Unexpected browser errors');
		expect(diagnostic?.errors.map((error) => error.message)).toEqual([
			'initial document failed',
			'later script failed'
		]);
		expect(diagnostic?.errors.every((error) => error.page === page.url())).toBe(true);
		for (const event of ['console', 'weberror', 'page'])
			expect(context.listenerCount(event)).toBe(0);
		for (const event of ['console', 'pageerror']) expect(page.listenerCount(event)).toBe(0);
	});
}

test('new apps and browser scaffolds use the automatic browser error fixture', () => {
	const files = projectFiles({ kind: 'app', name: 'console-proof' });
	for (const name of ['browserTest.ts', 'browserTest.types.ts', 'browserScreenshot.ts']) {
		expect(files.find((file) => file.path === `tests/e2e/support/${name}`)?.contents).toBe(
			readFileSync(`test/support/${name}`, 'utf8')
		);
	}
	for (const kind of ['e2e', 'resource'] as const) {
		const spec = pieceFiles(kind, 'Dashboard').find((file) => file.path.endsWith('.spec.ts'));
		expect(spec?.contents).toContain("from './support/browserTest'");
	}
});

test('agent and loop guidance requires clean normal flows and regression proof for errors', () => {
	const files = projectFiles({ kind: 'app', name: 'console-proof' });
	for (const path of ['AGENTS.md', '.codex/skills/harness/SKILL.md']) {
		const contents = files.find((file) => file.path === path)?.contents;
		expect(contents).toContain('console.error');
		expect(contents).toContain('pageerror');
		expect(contents).toContain('normal flows');
		expect(contents).toContain('expected errors');
		expect(contents).toContain('same unchanged');
	}
	expect(JSON.stringify(findGuide('loop'))).toContain('console.error');
});

test('Harness browser specs keep the automatic error gate enabled', () => {
	for (const directory of [
		'packages/desktop/tests/e2e',
		'packages/hub/tests/e2e',
		'packages/reports/tests/e2e',
		'packages/reports/test'
	]) {
		for (const file of readdirSync(directory).filter((file) => file.endsWith('.spec.ts'))) {
			const source = readFileSync(`${directory}/${file}`, 'utf8');
			expect(source, `${directory}/${file}`).toMatch(
				/import\s*\{[^}]*\btest\b[^}]*\}\s*from '[^']*\/test\/support\/browserTest'/
			);
		}
	}
});

test('browser generation installs missing support and preserves a customized shared fixture', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-browser-support-'));
	try {
		await writeFile(join(root, 'package.json'), JSON.stringify({ harness: { kind: 'app' } }));
		await generatePiece({ kind: 'e2e', name: 'First', root });
		const path = join(root, 'tests/e2e/support/browserTest.ts');
		const customized = (await readFile(path, 'utf8')) + '\n// Project customization.\n';
		await writeFile(path, customized);
		await generatePiece({ kind: 'e2e', name: 'Second', root });
		await generatePiece({ kind: 'resource', name: 'Article', force: true, root });
		expect(await readFile(path, 'utf8')).toBe(customized);
		await rm(join(root, 'tests/e2e/support'), { recursive: true });
		await generatePiece({ kind: 'resource', name: 'Note', root });
		expect(await readFile(path, 'utf8')).toContain('auto: true');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
