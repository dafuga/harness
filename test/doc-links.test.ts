import { expect, test } from 'vitest';
import { brokenDocLinks, headingAnchors, markdownLinks } from '../scripts/check-doc-links';

test('document links resolve relative files and anchors without treating code as links', () => {
	const sources: Record<string, string> = {
		'README.md':
			'# Start\n[Guide](docs/guide.md#two)\n`[code](missing.md)`\n```md\n[code](gone.md)\n```',
		'docs/guide.md': '# One\n## Two\n[Back](../README.md#start)'
	};
	const files = {
		exists: (path: string) => path in sources,
		read: (path: string) => sources[path]!
	};
	expect(brokenDocLinks(['README.md'], files)).toEqual([]);
	sources['docs/guide.md'] += '\n[Broken](missing.md)\n[Bad anchor](../README.md#gone)';
	expect(brokenDocLinks(['README.md'], files)).toEqual([
		'docs/guide.md:4: missing.md does not exist',
		'docs/guide.md:5: ../README.md#gone has no such heading'
	]);
	expect(markdownLinks('[Web](https://example.invalid)')).toEqual([
		{ line: 1, target: 'https://example.invalid' }
	]);
	expect([...headingAnchors('# Same\n# Same\n```\n# Hidden\n```')]).toEqual(['same', 'same-1']);
});

test('architecture source paths and paths outside the repository are diagnosed', () => {
	const sources: Record<string, string> = {
		'ARCHITECTURE.md': '`src/gone.ts`\n[Outside](../secret.md)'
	};
	const files = {
		exists: (path: string) => path in sources,
		read: (path: string) => sources[path]!
	};
	expect(brokenDocLinks(['ARCHITECTURE.md'], files, ['ARCHITECTURE.md'])).toEqual([
		'ARCHITECTURE.md:1: `src/gone.ts` does not exist',
		'ARCHITECTURE.md:2: ../secret.md leaves the repository'
	]);
});
