import {
	readme,
	onlyInCode,
	boundaries,
	pathNotes,
	guide,
	prose,
	resolvingProject,
	brokenProject,
	missingProject
} from './script.check-doc-links.fixtures';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import {
	brokenDocLinks,
	checkedDocuments,
	codePaths,
	headingAnchors,
	markdownLinks,
	pathCheckedDocuments
} from '../../scripts/check-doc-links';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * Each operation of the check-doc-links script is called the way the script calls it. What it was
 * given and what it returned is asserted and recorded as the cases of its state. brokenDocLinks
 * reads a temporary project folder, which is removed after each call.
 */

/** brokenDocLinks as the script calls it, reading the files of a temporary project folder. */
function checkProject(name: string, files: Record<string, string>) {
	return withTempDir('check-doc-links-', (root) => {
		for (const [path, text] of Object.entries(files)) {
			mkdirSync(dirname(join(root, path)), { recursive: true });
			writeFileSync(join(root, path), text);
		}
		const project = {
			exists: (path: string) => existsSync(join(root, path)),
			read: (path: string) => readFileSync(join(root, path), 'utf8')
		};
		const input = { documents: checkedDocuments, pathChecked: pathCheckedDocuments, files };
		const output = brokenDocLinks(checkedDocuments, project, pathCheckedDocuments);
		return { name, input, output };
	});
}

test('markdownLinks returned the target and line of each inline link and skipped links inside code spans and fenced blocks', () => {
	const inProse = markdownLinks(readme);
	const inCode = markdownLinks(onlyInCode);
	expect(inProse).toEqual([
		{ line: 3, target: 'docs/guide.md#setup-steps' },
		{ line: 3, target: '#demo' },
		{ line: 8, target: 'ARCHITECTURE-BOUNDARIES.md' },
		{ line: 8, target: 'https://example.com' }
	]);
	expect(inCode).toEqual([]);
	recordExampleCases(
		{
			unitId: 'script.check-doc-links',
			symbol: 'markdownLinks',
			state: 'markdown-links',
			evidence: 'examples-cases',
			file: 'markdown-links.json'
		},
		[
			{ name: 'prose links, a title and a URL', input: { source: readme }, output: inProse },
			{ name: 'links only in code spans or fences', input: { source: onlyInCode }, output: inCode }
		]
	);
});

test('codePaths returned each backticked repository source path with its line and skipped unticked, extensionless and fenced paths', () => {
	const inTable = codePaths(boundaries);
	const inNotes = codePaths(pathNotes);
	expect(inTable).toEqual([
		{ line: 5, target: 'src/core/files.ts' },
		{ line: 5, target: 'scripts/check-doc-links.ts' }
	]);
	expect(inNotes).toEqual([
		{ line: 1, target: 'packages/reports/src/index.ts' },
		{ line: 1, target: 'test/examples/x.test.ts' }
	]);
	recordExampleCases(
		{
			unitId: 'script.check-doc-links',
			symbol: 'codePaths',
			state: 'code-paths',
			evidence: 'examples-cases',
			file: 'code-paths.json'
		},
		[
			{
				name: 'a table row, beside an unticked path',
				input: { source: boundaries },
				output: inTable
			},
			{
				name: 'prose, beside an extensionless and a fenced path',
				input: { source: pathNotes },
				output: inNotes
			}
		]
	);
});

test('headingAnchors slugged each heading as GitHub does, numbered repeats, and found no anchors in prose or fenced text', () => {
	const inGuide = [...headingAnchors(guide)];
	const inProse = [...headingAnchors(prose)];
	expect(inGuide).toEqual(['setup', 'setup-1', 'setup-2', 'run-files--check-café']);
	expect(inProse).toEqual([]);
	recordExampleCases(
		{
			unitId: 'script.check-doc-links',
			symbol: 'headingAnchors',
			state: 'heading-anchors',
			evidence: 'examples-cases',
			file: 'heading-anchors.json'
		},
		[
			{
				name: 'closing hashes, repeats and punctuation, beside a hashtag and a fenced line',
				input: { source: guide },
				output: inGuide
			},
			{
				name: 'a heading-like code span and a fenced line in prose',
				input: { source: prose },
				output: inProse
			}
		]
	);
});

test('brokenDocLinks returned no problems when every link resolves, and one sorted line for each broken link, owner path or missing checked document', async () => {
	const resolved = await checkProject(
		'every link resolves and the URL is not fetched',
		resolvingProject
	);
	const broken = await checkProject(
		'a missing file, heading and owner path, and a link out of the repository',
		brokenProject
	);
	const missing = await checkProject(
		'the checked architecture document is missing',
		missingProject
	);
	expect(resolved.output).toEqual([]);
	expect(broken.output).toEqual([
		'ARCHITECTURE-BOUNDARIES.md:2: `src/missing/owner.ts` does not exist',
		'README.md:2: docs/guide.md#no-such-heading has no such heading',
		'README.md:2: docs/missing.md does not exist',
		'README.md:3: ../secret.md leaves the repository',
		'docs/guide.md:3: ../README.md#missing-anchor has no such heading'
	]);
	expect(missing.output).toEqual([
		'ARCHITECTURE-BOUNDARIES.md: checked document does not exist',
		'README.md:2: ARCHITECTURE-BOUNDARIES.md does not exist'
	]);
	recordExampleCases(
		{
			unitId: 'script.check-doc-links',
			symbol: 'brokenDocLinks',
			state: 'broken-doc-links',
			evidence: 'examples-cases',
			file: 'broken-doc-links.json'
		},
		[resolved, broken, missing]
	);
});
