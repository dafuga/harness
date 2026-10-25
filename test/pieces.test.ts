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
	const repositoryTest = pieceFiles('repository', 'Post').find((file) =>
		file.path.endsWith('test/repositories/post.test.ts')
	)!.contents;
	expect(repositoryTest).toContain('repository.save(record)');
	expect(repositoryTest).toContain('repository.find(record.id)');
	expect(repositoryTest).toContain('toBeUndefined()');
	expect(repositoryTest).not.toContain('toBeInstanceOf');
	expect(repositoryTest.match(/^test\(/gm)).toHaveLength(5);
	const validatorTest = pieceFiles('validator', 'Post').find((file) =>
		file.path.endsWith('test/validators/post.test.ts')
	)!.contents;
	expect(validatorTest).toContain("validate({ title: 'value' })");
	expect(validatorTest).toContain('validate({})');
	expect(validatorTest).toContain("errors: ['input is empty']");
	expect(validatorTest).not.toContain('toBeInstanceOf');
	expect(validatorTest.match(/^test\(/gm)).toHaveLength(3);
	const generatedCases = [
		[
			'controller',
			'Post',
			'test/controllers/post-controller.test.ts',
			1,
			['PostController.index from default initialization', '// => { ok: true }']
		],
		[
			'service',
			'Audit',
			'test/services/audit.test.ts',
			1,
			['AuditService.run from default initialization', "// => 'audit'"]
		],
		[
			'repository',
			'Post',
			'test/repositories/post.test.ts',
			5,
			[
				'find from empty initialization',
				'find from prepopulated initialization',
				'save from empty initialization',
				'save from prepopulated initialization',
				'rejects an invalid record',
				'// throws TypeError'
			]
		],
		[
			'adapter',
			'Post',
			'test/adapters/post.test.ts',
			3,
			[
				'connect from default initialization',
				'connect from custom initialization',
				'invalid config throws TypeError'
			]
		],
		[
			'validator',
			'Post',
			'test/validators/post.test.ts',
			3,
			['nonempty input', 'empty input', 'null input throws TypeError']
		],
		[
			'serializer',
			'Post',
			'test/serializers/post.test.ts',
			4,
			['empty input', 'populated input', 'null input', 'undefined input']
		],
		[
			'policy',
			'Post',
			'test/policies/post.test.ts',
			4,
			['admin actor', 'member actor', 'missing role', 'invalid actor throws TypeError']
		],
		[
			'seeder',
			'Post',
			'test/seeders/post.test.ts',
			1,
			['returns seed metadata for default invocation', "// => { seeded: 'post' }"]
		],
		[
			'util',
			'formatLabel',
			'test/utils/format-label.test.ts',
			3,
			['trims padded text input', 'null input throws TypeError', 'undefined input throws TypeError']
		]
	] as const;
	for (const [kind, name, path, count, markers] of generatedCases) {
		const generatedTest = pieceFiles(kind, name).find((file) => file.path === path)?.contents ?? '';
		expect(generatedTest, path).not.toContain('toBeInstanceOf');
		expect(generatedTest.match(/^test\(/gm), path).toHaveLength(count);
		for (const marker of markers) expect(generatedTest, path).toContain(marker);
	}
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
