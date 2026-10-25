import { ModuleDataRepository } from '../src/repositories/git-source-history/ModuleDataRepository';
import { ModuleDataReviewRepository } from '../src/repositories/git-source-history/ModuleDataReviewRepository';
import { ModuleDataCache } from '../src/services/git-source-history/module-data-service/ModuleDataCache';
import type {
	ModuleData,
	HistoryValidationReport,
	ValidationReport
} from '../src/services/git-source-history/ModuleDataService.types';
import { expect, test } from 'vitest';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	unitProject,
	slugifySource,
	titleServiceSource,
	configureTestAuthor,
	validationInvoker,
	verifyReview
} from './support/unitProject';
import { runCommand } from './support/cli';

test('validate persists revision-bound module gaps, filters them and invalidates cached searches', async () => {
	const project = await unitProject('lib');
	const git = (args: string[]) => runCommand(['git', ...args], project.root);
	try {
		await git(['init', '-b', 'main']);
		await configureTestAuthor(project.root);
		await project.write('src/utils/slugify.ts', slugifySource);
		await project.write('src/services/TitleService.ts', titleServiceSource);
		await project.harness(['units', 'index', '--write']);
		await git(['add', '.']);
		await git(['commit', '-m', 'feat: define title modules']);
		const head = (await git(['rev-parse', 'HEAD'])).stdout.trim();
		const invoke = validationInvoker(project);
		const before = await invoke([]);
		expect(before.commit).toBe(head);
		expect(before.committed).toBe(false);
		expect(before.exitCode).toBe(1);
		const written = await invoke(['--write']);
		expect(written.committed).toBe(true);
		expect(written.modules).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: 'service.title', issues: expect.any(Array) })
			])
		);
		await verifyReview(project.root, git, invoke, head);
		await rejectStaleReview(project);
		await git(['update-ref', 'refs/heads/harness-evidence', head]);
		expect(
			(await invoke([])).committed,
			'Evidence updates must preserve committed metadata admission'
		).toBe(true);
		const cached = await invoke(['--module', 'service.title']);
		expect(cached.cached).toBe(true);
		expect(cached.modules.map((item: { id: string }) => item.id)).toEqual(['service.title']);
		const typed = await invoke(['--type', 'services']);
		expect(typed.modules.map((item: { kind: string }) => item.kind)).toEqual(['service']);
		expect((await invoke(['--module', 'absent.unit'])).issues.join(' ')).toContain(
			'Unknown module'
		);
		await project.write(
			'src/services/TitleService.ts',
			titleServiceSource + '\n// changed revision\n'
		);
		await git(['add', '.']);
		await git(['commit', '-m', 'chore: change title source']);
		const changed = await invoke([]);
		expect(changed.commit).not.toBe(head);
		expect(changed.committed).toBe(false);
		const history = (await invoke(['--history', '--write'])) as unknown as HistoryValidationReport;
		expect(history.revisions.map((item: { commit: string }) => item.commit)).toContain(head);
		expect((await git(['rev-parse', 'HEAD'])).stdout.trim()).toBe(changed.commit);
		expect((await git(['status', '--porcelain'])).stdout.trim()).toBe('');
	} finally {
		await rm(join(project.root, '..'), { recursive: true, force: true });
	}
}, 180_000);

test('validate commits source-derived page API usage and explicit visual data gaps', async () => {
	const project = await unitProject('app');
	const git = (args: string[]) => runCommand(['git', ...args], project.root);
	try {
		await git(['init', '-b', 'main']);
		await configureTestAuthor(project.root);
		await project.write(
			'src/routes/+page.svelte',
			'<script>import Titles from "../components/Titles.svelte";</script><Titles />'
		);
		await project.write(
			'src/components/Titles.svelte',
			'<script>fetch("/api/titles");</script><div>Titles</div>'
		);
		await project.write(
			'src/routes/api/titles/+server.ts',
			'export function GET(): Response { return Response.json([]); }'
		);
		await project.harness(['units', 'index', '--write']);
		await git(['add', '.']);
		await git(['commit', '-m', 'feat: declare page API usage']);
		const result = await project.harness(['validate', '--write', '--json'], false);
		expect(result.stdout).toContain('"modules"');
		const report = JSON.parse(result.stdout) as ValidationReport;
		expect(report.committed).toBe(true);
		const paths = (
			await git(['ls-tree', '-r', '--name-only', report.metadataCommit!])
		).stdout.split('\n');
		const path = paths.find((path) => path.startsWith(`modules/${report.commit}/`))!;
		const data = JSON.parse(
			(await git(['show', `${report.metadataCommit}:${path}`])).stdout
		) as ModuleData;
		const page = data.registry.units.find((unit) =>
			unit.owns.source.includes('src/routes/+page.svelte')
		)!;
		const api = data.registry.units.find((unit) =>
			unit.owns.source.includes('src/routes/api/titles/+server.ts')
		)!;
		expect(api.title).toBe('/api/titles');
		expect(data.relationships[page.id].apis).toEqual([api.id]);
		expect(report.modules.find((unit) => unit.id === page.id)!.issues.length).toBeGreaterThan(0);
	} finally {
		await rm(join(project.root, '..'), { recursive: true, force: true });
	}
}, 180_000);

// Historical source layout is preserved; data admission must still demand owned source and examples.
test('historical helper layout does not masquerade as missing module metadata', async () => {
	const project = await unitProject('lib');
	const git = (args: string[]) => runCommand(['git', ...args], project.root);
	try {
		await git(['init', '-b', 'main']);
		await configureTestAuthor(project.root);
		await project.write('src/utils/slugify.ts', '/** @pure */\n' + slugifySource);
		for (const name of ['first', 'second'])
			await project.write(
				`src/utils/${name}.ts`,
				`import { slugify } from './slugify'; export function ${name}(value: string) { return slugify(value); }`
			);
		await project.harness(['units', 'index', '--write']);
		const path = 'specification/units/function.slugify.json';
		const manifest = await project.json<Record<string, unknown>>(path);
		manifest.helperContracts = historicalSlugifyContract();
		await project.write(path, JSON.stringify(manifest));
		await git(['add', '.']);
		await git(['commit', '-m', 'feat: retain historical helper source']);
		const review = join(project.root, '..', 'historical-review.json');
		await writeFile(
			review,
			JSON.stringify({
				unit: 'function.slugify',
				reason: 'Review the helper in its historical owned location.',
				metadata: { helperContracts: manifest.helperContracts }
			})
		);
		const report = await validationInvoker(project)([
			'--write',
			'--review',
			review,
			'--module',
			'function.slugify'
		]);
		expect(report.valid, JSON.stringify(report.modules)).toBe(true);
		expect(
			report.modules[0].issues.filter((issue: { kind?: string }) => issue.kind !== 'evidence')
		).toEqual([]);
		const audit = await project.harness(['units', 'check'], false);
		expect(audit.stdout + audit.stderr).toContain('must be implemented under src/helpers/');
	} finally {
		await rm(join(project.root, '..'), { recursive: true, force: true });
	}
}, 180_000);

function historicalSlugifyContract() {
	return [
		{
			name: 'slugify',
			source: 'src/utils/slugify.ts',
			inputs: [{ name: 'input', type: 'string' }],
			output: 'string',
			pure: true,
			consumers: [{ unit: 'function.first' }, { unit: 'function.second' }],
			examples: [
				{
					name: 'Normalize a title',
					call: 'slugify("Hello World")',
					input: ['Hello World'],
					output: 'hello-world'
				}
			]
		}
	];
}

async function rejectStaleReview(project: Awaited<ReturnType<typeof unitProject>>) {
	const repository = new ModuleDataRepository(project.root);
	const identity = await repository.identity('HEAD');
	const held = (await repository.read(identity))!;
	await new ModuleDataReviewRepository(project.root).write(identity, held.data.declarations, {
		unit: 'service.title',
		reason: 'Review metadata changed independently of source or evidence refs.',
		metadata: { responsibility: 'Serve reviewed title metadata from this exact source revision.' }
	});
	expect(
		await repository.read(identity),
		'A changed review must invalidate committed module admission'
	).toBeUndefined();
	expect(
		await new ModuleDataCache(repository).read(identity),
		'A changed review must invalidate cached diagnostics'
	).toBeUndefined();
	expect(
		await new ModuleDataCache(repository).read(identity, true),
		'A changed review must invalidate cached source metadata'
	).toBeUndefined();
	await validationInvoker(project)(['--write']);
	expect(
		(await repository.read(identity))!.data.declarations.find(
			(unit) => unit.id === 'service.title'
		)!.responsibility
	).toBe('Serve reviewed title metadata from this exact source revision.');
}
