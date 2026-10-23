import { expect, test } from 'vitest';
import { pieceFiles } from '../src/templates/pieces';
import { isAppOnlyScaffold, scaffoldKinds } from '../src/templates/scaffoldTypes';

test.each(['2d', '3d'] as const)(
	'every scaffold kind creates at least one file in a %s project',
	(dimension) => {
		for (const kind of scaffoldKinds) {
			const files = pieceFiles(kind, 'BlogPost', { dimension });
			expect(files.length, kind).toBeGreaterThan(0);
			expect(
				files.every((file) => file.path.length > 0 && file.contents.length > 0),
				kind
			).toBe(true);
		}
		const [view] = pieceFiles('game-view', 'BlogPost', { dimension });
		expect(view.contents).toContain(`dimension: '${dimension}'`);
		expect(() => pieceFiles('game-view', 'BlogPost')).toThrow('harness.dimension');
	}
);

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
	expect(isAppOnlyScaffold('partial')).toBe(true);
	expect(isAppOnlyScaffold('resource')).toBe(true);
	expect(isAppOnlyScaffold('service')).toBe(false);
	expect(isAppOnlyScaffold('repository')).toBe(false);
	expect(isAppOnlyScaffold('mailer')).toBe(false);
});

test('Rails-ish scaffolds create their expected code shapes', () => {
	expect(pieceFiles('mailer', 'Welcome').map((file) => file.path)).toContain(
		'src/mailers/WelcomeMailer.ts'
	);
	expect(pieceFiles('helper', 'Post').map((file) => file.path)).toContain(
		'src/helpers/PostHelper.ts'
	);
	expect(pieceFiles('concern', 'Publishable').map((file) => file.path)).toContain(
		'src/concerns/withPublishable.ts'
	);
	expect(pieceFiles('channel', 'Activity').map((file) => file.path)).toContain(
		'src/channels/ActivityChannel.ts'
	);
	expect(pieceFiles('form', 'Post').map((file) => file.path)).toContain('src/forms/PostForm.ts');
	expect(pieceFiles('partial', 'PostCard').map((file) => file.path)).toContain(
		'src/components/partials/PostCardPartial.svelte'
	);
	expect(pieceFiles('initializer', 'Cache').map((file) => file.path)).toContain(
		'src/initializers/initializeCache.ts'
	);
	expect(pieceFiles('config', 'Search').map((file) => file.path)).toContain(
		'src/configs/searchConfig.ts'
	);
	expect(pieceFiles('middleware', 'Auth').map((file) => file.path)).toContain(
		'src/middleware/AuthMiddleware.ts'
	);
	expect(pieceFiles('resource', 'Article').map((file) => file.path)).toContain(
		'src/routes/article/+page.svelte'
	);
});
