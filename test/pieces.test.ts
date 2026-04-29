import { expect, test } from 'vitest';
import { pieceFiles } from '../src/templates/pieces';
import { isAppOnlyScaffold, scaffoldKinds } from '../src/templates/scaffoldTypes';

test('every scaffold kind creates at least one file', () => {
	for (const kind of scaffoldKinds) {
		const files = pieceFiles(kind, 'BlogPost');
		expect(files.length, kind).toBeGreaterThan(0);
		expect(files.every((file) => file.path.length > 0 && file.contents.length > 0), kind).toBe(true);
	}
});

test('view, layout, and api scaffolds use SvelteKit route files', () => {
	expect(pieceFiles('view', 'BlogPost').map((file) => file.path)).toContain(
		'src/routes/blog-post/+page.svelte'
	);
	expect(pieceFiles('layout', 'BlogPost').map((file) => file.path)).toContain(
		'src/routes/blog-post/+layout.svelte'
	);
	expect(pieceFiles('api', 'BlogPost').map((file) => file.path)).toContain(
		'src/routes/api/blog-post/+server.ts'
	);
});

test('marks only SvelteKit scaffolds as app-only', () => {
	expect(isAppOnlyScaffold('view')).toBe(true);
	expect(isAppOnlyScaffold('component')).toBe(true);
	expect(isAppOnlyScaffold('service')).toBe(false);
	expect(isAppOnlyScaffold('repository')).toBe(false);
});
