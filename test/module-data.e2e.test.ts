import type {
	ModuleData,
	ValidationReport
} from '../src/services/git-source-history/ModuleDataService.types';
import { expect, test } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { unitProject, slugifySource, titleServiceSource } from './support/unitProject';
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
		const invoke = async (args: string[]) => {
			const result = await project.harness(['validate', ...args, '--json'], false);
			expect(result.stdout, 'Validation returns structured per-module diagnostics').toContain(
				'"modules"'
			);
			return { ...JSON.parse(result.stdout), exitCode: result.exitCode };
		};
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
		const history = await invoke(['--history', '--write']);
		expect(history.revisions.map((item: { commit: string }) => item.commit)).toContain(head);
		expect((await git(['rev-parse', 'HEAD'])).stdout.trim()).toBe(changed.commit);
		expect((await git(['status', '--porcelain'])).stdout.trim()).toBe('');
	} finally {
		await rm(join(project.root, '..'), { recursive: true, force: true });
	}
}, 180_000);

async function configureTestAuthor(root: string) {
	await runCommand(['git', 'config', 'user.name', 'Harness Test'], root);
	await runCommand(['git', 'config', 'user.email', 'harness@example.invalid'], root);
}

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
