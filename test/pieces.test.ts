import { measureWorkload } from './support/measureWorkload';
import { check } from 'prettier';
import { formatConfigFiles } from '../src/templates/development-tooling/formatConfig';
import { pieceExportPlans } from '../src/workflows/projects-sessions/generate-code/exportPlans';
import { posix } from 'node:path';
import { expect, test } from 'vitest';
import { pieceFiles } from '../src/templates/pieces';
import { isAppOnlyScaffold, scaffoldKinds } from '../src/templates/scaffoldTypes';

test.each(['2d', '3d'] as const)(
	'every scaffold kind creates at least one file in a %s project',
	async (dimension) => {
		for (const kind of scaffoldKinds)
			await measureWorkload(
				kind === 'resource'
					? 'template.model'
					: 'template.development-tooling-separate-type-declarations',
				`generate-formatted-${kind}-${dimension}`,
				async () => {
					const files = pieceFiles(kind, 'BlogPost', { dimension });
					const options = JSON.parse(
						formatConfigFiles().find((file) => file.path === '.prettierrc')!.contents
					);
					for (const file of files.filter((file) => file.path.endsWith('.ts')))
						expect(
							await check(file.contents, { ...options, filepath: file.path }),
							`Generated TypeScript follows the emitted project formatter: ${file.path}`
						).toBe(true);
					expect(files.length, kind).toBeGreaterThan(0);
					for (const plan of pieceExportPlans(kind, 'BlogPost'))
						expect(
							files.map((file) => file.path),
							'Every public export targets an emitted scaffold'
						).toContain(posix.normalize(`src/${plan.source}.ts`));
					expect(
						files.every((file) => file.path.length > 0 && file.contents.length > 0),
						kind
					).toBe(true);
				}
			);
		const [view] = await measureWorkload('template.game-pieces', `game-view-${dimension}`, () =>
			pieceFiles('game-view', 'BlogPost', { dimension })
		);
		expect(view.contents).toContain(`dimension: '${dimension}'`);
		expect(() => pieceFiles('game-view', 'BlogPost')).toThrow('harness.dimension');
	}
);

test('view, layout, and api scaffolds use SvelteKit route files', () => {
	const component = pieceFiles('component', 'StatusBadge');
	const componentTest = component.find((file) => file.path.endsWith('-component.spec.ts'));
	expect(component.map((file) => file.path)).toContain(
		'src/routes/__harness/components/status-badge/+page.svelte'
	);
	expect(componentTest?.contents).toContain('toHaveScreenshot(state.screenshot)');
	expect(componentTest?.contents).toContain("id: 'interaction-expanded'");
	expect(componentTest?.contents).toContain("id: 'error-prop'");

	expect(pieceFiles('view', 'BlogPost').map((file) => file.path)).toContain(
		'src/routes/blog-post/+page.svelte'
	);
	const viewTest = pieceFiles('view', 'BlogPost').find((file) =>
		file.path.endsWith('-page.spec.ts')
	);
	expect(viewTest?.contents).toContain('toHaveScreenshot(state.screenshot)');
	expect(viewTest?.contents).toContain("id: 'error-state'");
	const e2eTest = pieceFiles('e2e', 'BlogPost').find((file) =>
		file.path.endsWith('blog-post.spec.ts')
	);
	expect(e2eTest?.contents).toContain('toHaveScreenshot(state.screenshot)');
	expect(e2eTest?.contents).toContain("from './support/browserTest'");
	expect(pieceFiles('layout', 'BlogPost').map((file) => file.path)).toContain(
		'src/routes/blog-post/+layout.svelte'
	);
	expect(pieceFiles('api', 'BlogPost').map((file) => file.path)).toContain(
		'src/routes/api/blog-post/+server.ts'
	);
	const apiTest = pieceFiles('api', 'BlogPost').find((file) => file.path.endsWith('-api.test.ts'));
	expect(apiTest?.contents).toContain('test.each(cases)');
	expect(apiTest?.contents).toContain("contentType: 'application/json'");
	expect(apiTest?.contents).toContain("id: 'error prop returns complete JSON'");
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

test('Rails-ish scaffolds create their expected code shapes', async () => {
	expect(pieceFiles('mailer', 'Welcome').map((file) => file.path)).toContain(
		'src/mailers/WelcomeMailer.ts'
	);
	expect(pieceFiles('helper', 'Post').map((file) => file.path)).toContain('src/helpers/post.ts');
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
	await measureWorkload('workflow.export-plans', 'config-sdk-export-address', () => {
		expect(pieceExportPlans('config', 'Search')).toEqual([
			{ source: './configs/searchConfig', named: ['searchConfig'] }
		]);
	});
	const config = await measureWorkload('template.rails-pieces', 'generate-config-shape', () =>
		pieceFiles('config', 'Search')
	);
	expect(config.map((file) => file.path)).toContain('src/configs/searchConfig.ts');
	const configSource = config.find((file) => file.path === 'src/configs/searchConfig.ts')!;
	expect(configSource.contents).toContain('export const searchConfig = {} as const;');
	expect(configSource.contents).not.toMatch(/\b(?:name|enabled):/);
	expect(pieceFiles('middleware', 'Auth').map((file) => file.path)).toContain(
		'src/middleware/AuthMiddleware.ts'
	);
	expect(pieceFiles('resource', 'Article').map((file) => file.path)).toContain(
		'src/routes/article/+page.svelte'
	);
});

test('helper scaffolds emit pure camelCase functions with domain parameters', () => {
	const files = pieceFiles('helper', 'formatLabel');
	const source = files.find((file) => file.path === 'src/helpers/formatLabel.ts');
	expect(source?.contents).toContain('/** @pure */');
	expect(source?.contents).toContain('export function formatLabel(textToFormat: string): string');
	expect(source?.contents).not.toContain('class ');
	expect(files.find((file) => file.path.startsWith('test/helpers/'))?.contents).toContain(
		"formatLabel('  label  ')"
	);
});
