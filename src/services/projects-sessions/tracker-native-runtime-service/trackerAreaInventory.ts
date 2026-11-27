// @harness-uid u_bl6xl2h4a3
import { TrackerHostProcessError } from '../../../adapters/projects-sessions/tracker-host-process-adapter/TrackerHostProcessError';
import { basename } from 'node:path';
import { stat } from 'node:fs/promises';
import { z } from 'zod';
import { runTrackerHostCommand } from '../../../adapters/projects-sessions/tracker-host-process-adapter/trackerHostCommand';
import { areaClaim, areaIntersects } from '../tracker-hub-sync/trackerAreaClaim';
import { trackerGithubRequest } from './trackerGithubCli';
import type { TrackerHostRepository } from './nativeTrackerHostEffects.types';

const pull = z.object({
	number: z.int().positive(),
	headRefName: z.string(),
	headRefOid: z.string(),
	baseRefName: z.string(),
	author: z.object({ login: z.string() }).nullable(),
	changedFiles: z.int().nonnegative(),
	files: z.array(z.object({ path: z.string(), changeType: z.string() }))
});
const maxPulls = 1000;
const links = /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)\b/gi;
const shortLink = /\bPR\s*#(\d+)\b/gi;

/** Explicit Areas lines include new files. Existing paths and unambiguous module names can be inferred. */
export function intendedAreas(
	text: string,
	tracked: string[],
	linked: z.infer<typeof pull>[],
	extra: string[] = []
) {
	const declared = [...text.matchAll(/^\s*areas:\s*(.+)$/gim)].flatMap(([, value]) =>
		value.split(',').map((s) => s.trim().replace(/\/$/, ''))
	);
	const names = new Set(text.match(/[\w./-]+/g) ?? []);
	const inferred = tracked.filter(
		(path) =>
			names.has(path) ||
			names.has(basename(path)) ||
			names.has(basename(path).replace(/\.[^.]+$/, ''))
	);
	const paths = [
		...new Set([
			...extra,
			...declared,
			...inferred,
			...linked.flatMap((pr) => pr.files.map((f) => f.path))
		])
	];
	return paths.length ? areaClaim.shape.areas.parse(paths) : ['.'];
}

/** Keep credentials and repository URLs out of diagnostics. Only a configured checkout is scanned. */
export async function trackerAreaInventory(
	route: TrackerHostRepository,
	text: string,
	signal: AbortSignal,
	{ project = basename(route.repo), extra = [] }: { project?: string; extra?: string[] } = {}
) {
	const git = checkoutReader(route, signal);
	const tracked = await checkoutPaths(route, git, signal);
	const localRepo = {
		repo: 'workspace/' + project.toLowerCase(),
		areas: intendedAreas(text, tracked ?? [], [], extra),
		siblings: []
	};
	if (!tracked || !(await git(['remote']))) return localRepo;
	const repo = githubRepository(await git(['remote', 'get-url', 'origin']));
	if (!route.github)
		throw new TrackerHostProcessError(
			'Configure the repository GitHub read binding for Tracker area checks'
		);
	const request = trackerGithubRequest(route.github);
	const pulls = await readAreaPulls(repo, request, signal);
	const refs = linkedPulls(text, repo);
	const areas = intendedAreas(
		text,
		tracked,
		pulls.filter((p) => refs.has(p.number)),
		extra
	);
	const siblings = pulls.filter((pr) =>
		pr.files.some(({ path }) => areas.some((a) => areaIntersects(a, path)))
	);
	return { repo, areas, siblings };
}

async function readAreaPulls(
	repo: string,
	request: ReturnType<typeof trackerGithubRequest>,
	signal: AbortSignal
) {
	const args = [
		'pr',
		'list',
		'--repo',
		'github.com/' + repo,
		'--state',
		'open',
		'--limit',
		String(maxPulls + 1),
		'--json',
		'number,headRefName,headRefOid,baseRefName,author,changedFiles,files'
	];
	const response = await request(args, signal);
	if (response.code !== 0)
		throw new TrackerHostProcessError('Tracker cannot read open pull requests');
	const pulls = z.array(pull).max(maxPulls).parse(JSON.parse(response.stdout));
	for (const pr of pulls) {
		if (pr.files.length === pr.changedFiles && !pr.files.some((f) => f.changeType === 'RENAMED'))
			continue;
		const reply = await request(
			[
				'api',
				'--hostname',
				'github.com',
				'--paginate',
				'--slurp',
				`repos/${repo}/pulls/${pr.number}/files?per_page=100`
			],
			signal
		);
		if (reply.code !== 0)
			throw new TrackerHostProcessError('Tracker cannot read the complete pull request paths');
		const files = z
			.array(z.array(z.object({ filename: z.string(), previous_filename: z.string().optional() })))
			.parse(JSON.parse(reply.stdout))
			.flat();
		if (files.length !== pr.changedFiles)
			throw new TrackerHostProcessError('Incomplete pull request path inventory');
		pr.files = files.flatMap((f) =>
			[f.filename, ...(f.previous_filename ? [f.previous_filename] : [])].map((path) => ({
				path,
				changeType: 'CHANGED'
			}))
		);
	}
	return pulls.sort((a, b) => a.number - b.number);
}

function linkedPulls(text: string, repo: string) {
	const refs = new Set([...text.matchAll(shortLink)].map(([, number]) => Number(number)));
	for (const [, target, number] of text.matchAll(links))
		if (target.toLowerCase() === repo) refs.add(Number(number));
	return refs;
}

function checkoutReader(route: TrackerHostRepository, signal: AbortSignal) {
	return async (args: string[]) => {
		const result = await runTrackerHostCommand('/usr/bin/git', ['-C', route.repo, ...args], signal);
		if (result.code !== 0) throw new TrackerHostProcessError('Cannot read checkout');
		return result.stdout.trimEnd();
	};
}
async function checkoutPaths(
	route: TrackerHostRepository,
	git: ReturnType<typeof checkoutReader>,
	signal: AbortSignal
) {
	if (!(await stat(route.repo)).isDirectory())
		throw new TrackerHostProcessError('Checkout is unavailable');
	const probe = await runTrackerHostCommand(
		'/usr/bin/git',
		['-C', route.repo, 'rev-parse', '--git-dir'],
		signal
	);
	if (probe.code === 0) return (await git(['ls-files', '-z'])).split('\0').filter(Boolean);
	if (/not a git repository/i.test(probe.stderr)) return undefined;
	throw new TrackerHostProcessError('Cannot identify checkout');
}

function githubRepository(remote: string) {
	const repo =
		/^(?:git@github\.com:|https:\/\/github\.com\/|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i
			.exec(remote)?.[1]
			?.toLowerCase();
	if (!repo)
		throw new TrackerHostProcessError(
			'Tracker needs the GitHub repository identity for this checkout'
		);
	return repo;
}
