import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ProjectSessionService } from '../src/services/ProjectSessionService';
import { loaders, manifest, ordinary, rendered, twin } from './catalog-listing-manifests';
import type { Listing } from './catalog-listing-manifests';
import type { ComponentManifest } from '../../../src/lib/contracts';
import type { DesignVersion } from '../src/models/Desktop.types';
import type { PlanRecord } from '../src/models/PlanningPort.types';

/** The plan/version states a catalog can receive, independent of image storage. */
export const imagelessDesign: DesignVersion = {
	version: 'v001',
	createdAt: '2026-10-17T00:00:00.000Z',
	commit: null,
	generator: 'fixture',
	prompt: 'Describe the page',
	baseRevision: 'a'.repeat(40),
	images: [],
	approval: null
};
export function pagePlan(unit: ComponentManifest, versions: DesignVersion[] = []): PlanRecord {
	return {
		id: unit.id,
		path: 'src/pages/orders',
		category: 'pages',
		title: unit.title,
		goal: unit.responsibility,
		lifecycle: 'draft',
		contract: { inputs: [], outputs: [], errors: [], hash: null },
		versions,
		threads: []
	};
}

const git = (root: string, ...args: string[]) =>
	execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

async function put(root: string, path: string, content: string) {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), content);
}

/** A manifest and every file it owns, as they are at the commit that is made next. */
async function held(root: string, listing: Listing) {
	const [id, , responsibility, source] = listing;
	for (const path of source) await put(root, path, `// ${id}: ${responsibility}\n`);
	await put(root, `specification/units/${id}.json`, JSON.stringify(manifest(listing)));
}

function committed(root: string, subject: string): string {
	git(root, 'add', '.');
	git(root, 'commit', '-q', '-m', subject);
	return git(root, 'rev-parse', 'HEAD');
}

/**
 * A disposable Git project of two commits, opened by the real session. At `then` the analytics
 * identity is a rendered page; at `tip` it and three more only load for an address. The caller
 * closes it.
 */
export async function listingProject(options: { twin?: boolean } = {}) {
	const root = await realpath(await mkdtemp(join(tmpdir(), 'harness-listing-')));
	git(root, 'init', '-q', '-b', 'main');
	git(root, 'config', 'user.name', 'Fixture');
	git(root, 'config', 'user.email', 'fixture@example.invalid');
	for (const listing of [rendered, ...ordinary, ...(options.twin ? [twin] : [])])
		await held(root, listing);
	const then = committed(root, 'feat: chart every run on an analytics page');
	git(root, 'rm', '-q', rendered[3][1]);
	for (const listing of loaders) await held(root, listing);
	const tip = committed(root, 'feat: former addresses only redirect');
	const session = new ProjectSessionService();
	await session.open(root);
	const close = () => rm(root, { recursive: true, force: true });
	return { then, tip, session, close, ...session.requireProject() };
}
