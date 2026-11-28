// @harness-uid u_g7kdpz7bel
import firstRelease from '../../../../specification/harness-first-release-modules.json';
import { readHarborModulePlan } from './readHarborModulePlan';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type {
	ProjectModule,
	ProjectModulePlan
} from '../../../helpers/projects-sessions/projectModuleProgress.types';
import { UnitRegistryRepository } from '../../../repositories/verification-evidence/UnitRegistryRepository';
import { ModuleTaskRepository } from '../../../repositories/agents-providers/ModuleTaskRepository';
import type { ModuleTask } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TrackerLocalApiDependencies } from '../TrackerLocalApiService.types';
import { trackerResponse } from './trackerLocalResponse';

const integrated = 'refs/remotes/origin/main';
const unavailable = { state: 'unavailable' } as const;
const first = new Set(firstRelease.modules);

export async function readTrackerProjectProgress(
	request: Request,
	ctx: TrackerLocalApiDependencies
) {
	const project = new URL(request.url).searchParams.get('project')?.trim().toLowerCase();
	if (!project || !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(project)) {
		return trackerResponse(400, { error: 'A project name is required.' });
	}
	const directory = ctx.options.projectPlanDirectory ?? join(homedir(), 'projects');
	const plan = await readModulePlan(project, directory, ctx.items).catch(() => unavailable);
	return trackerResponse(200, { project, plan });
}

async function readModulePlan(
	project: string,
	directory: string,
	items: TrackerLocalApiDependencies['items']
) {
	if (project === 'harbor') return readHarborModulePlan(join(directory, 'harbor'));
	if (project !== 'harness') return unavailable;
	return harnessPlan(join(directory, 'harness'), activeTaskModules(items));
}

function activeTaskModules(items: TrackerLocalApiDependencies['items']) {
	const rows = items.list({ agent: 'harness', status: 'all', limit: -1 });
	return new Set(
		rows.flatMap(({ title, status, sensitive, deleted }) => {
			if (sensitive || deleted || !['in_progress', 'blocked', 'done'].includes(status ?? ''))
				return [];
			const match = /(?:^|\()p4\.([a-z0-9][a-z0-9._-]*)(?=\)|\s|$)/.exec(title ?? '');
			return match ? [match[1]] : [];
		})
	);
}

async function harnessPlan(root: string, active: ReadonlySet<string>): Promise<ProjectModulePlan> {
	const { units, tasks, proven } = await moduleSource(root);
	const modules: ProjectModule[] = units.map(({ id, title }) => ({
		id,
		...(title !== id && { title: title.slice(0, 200) }),
		release: first.has(id) ? 'first' : 'later',
		state: moduleState(id, active, tasks.get(id), proven)
	}));
	return modules.length ? { state: 'available', modules } : unavailable;
}

function moduleState(
	id: string,
	active: ReadonlySet<string>,
	tasks: ModuleTask[] | undefined,
	proven: ReadonlySet<string>
): ProjectModule['state'] {
	if (proven.has(id)) return 'built';
	return first.has(id) || active.has(id) || tasks?.some(({ status }) => status !== 'queued')
		? 'in_progress'
		: 'planned';
}

const cache = new Map<string, { expiresAt: number; source: ReturnType<typeof readModuleSource> }>();

function moduleSource(root: string) {
	const now = Date.now();
	const previous = cache.get(root);
	if (previous && previous.expiresAt > now) return previous.source;
	const source = readModuleSource(root);
	cache.set(root, { expiresAt: now + 30_000, source });
	void source.catch(() => {
		if (cache.get(root)?.source === source) cache.delete(root);
	});
	return source;
}

async function readModuleSource(root: string) {
	const tree = await CommitTreeAdapter.open(root, integrated);
	const [registry, queue] = await Promise.all([
		new UnitRegistryRepository(root).read(tree),
		new ModuleTaskRepository(root).read()
	]);
	if (registry.errors.length) throw new Error('Harness unit registry could not be read');
	const units = registry.manifests.filter(({ status }) => status === 'active');
	const tasks = new Map<string, ModuleTask[]>();
	for (const task of queue.data.tasks) {
		const { id } = task.module;
		const existing = tasks.get(id);
		if (existing) existing.push(task);
		else tasks.set(id, [task]);
	}
	const proven = await mergedModuleProofs(root, tree.revision, tasks);
	return { units, tasks, proven };
}

async function mergedModuleProofs(
	root: string,
	revision: string,
	tasks: Map<string, ModuleTask[]>
) {
	const git = new GitAdapter(root);
	const revisions = new Map<string, Promise<boolean>>();
	const merged = (commit: string) => {
		const cached = revisions.get(commit);
		if (cached) return cached;
		const exists = git
			.attempt(['merge-base', '--is-ancestor', commit, revision])
			.then((result) => result !== undefined);
		revisions.set(commit, exists);
		return exists;
	};
	const proven = new Set<string>();
	for (const [id, moduleTasks] of tasks) {
		for (const task of moduleTasks) {
			const proof = acceptedProof(task);
			if (!proof || !(await merged(proof.commit))) continue;
			if (!(await modulePathsMatch(git, task, proof.commit, revision))) continue;
			proven.add(id);
			break;
		}
	}
	return proven;
}

// Older accepted tasks may have no acceptance record or a pass that ran no checks.
function acceptedProof(task: ModuleTask) {
	if (task.status !== 'accepted' || !task.result?.attempt) return undefined;
	const review = task.reviews.find(({ attempt }) => attempt === task.result?.attempt);
	return review?.verdict === 'accepted' && review.evidence?.checks ? review.evidence : undefined;
}

async function modulePathsMatch(
	git: GitAdapter,
	task: ModuleTask,
	proof: string,
	revision: string
) {
	const paths = [...task.module.files, ...(task.verificationFiles ?? [])];
	return (
		(await git.attempt([
			'--literal-pathspecs',
			'diff',
			'--quiet',
			proof,
			revision,
			'--',
			...paths
		])) !== undefined
	);
}
