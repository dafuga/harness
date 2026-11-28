// @harness-uid u_bl6xl2h4a3
import { z } from 'zod';
import { TrackerHostProcessError } from '../../../adapters/projects-sessions/tracker-host-process-adapter/TrackerHostProcessError';
import { trackerGithubRequest } from './trackerGithubCli';
import type { TrackerHostRepository } from './nativeTrackerHostEffects.types';
import type { AreaPull, OpenPulls } from './trackerAreaPulls.types';

export const areaPull = z.object({
	number: z.int().positive(),
	headRefName: z.string(),
	headRefOid: z.string(),
	baseRefName: z.string(),
	author: z.object({ login: z.string() }).nullable(),
	changedFiles: z.int().nonnegative(),
	files: z.array(z.object({ path: z.string(), changeType: z.string() }))
});
const maxPulls = 1000;
const shownPulls = 10;

/** Open pull requests only inform the brief, so a missing or failing reader is a warning. */
export async function openAreaPulls(
	route: TrackerHostRepository,
	repo: string,
	signal: AbortSignal
): Promise<OpenPulls> {
	if (!route.github)
		return {
			pulls: [],
			warning: 'No GitHub read binding for this checkout, so open pull requests were not checked'
		};
	try {
		return { pulls: await readAreaPulls(repo, trackerGithubRequest(route.github), signal) };
	} catch {
		return { pulls: [], warning: 'Open pull requests could not be read, so none were checked' };
	}
}

export function openPullWarning(repo: string, pulls: AreaPull[]) {
	const names = pulls
		.slice(0, shownPulls)
		.map(
			(pr) => `${repo}#${pr.number} (${pr.author?.login ?? 'unknown owner'}, ${pr.headRefName})`
		);
	const more = pulls.length - names.length;
	return (
		'Open pull requests touch these paths; check them and land after them: ' +
		names.join(', ') +
		(more > 0 ? ` and ${more} more` : '')
	);
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
	const pulls = z.array(areaPull).max(maxPulls).parse(JSON.parse(response.stdout));
	for (const pr of pulls) {
		if (pr.files.length === pr.changedFiles && !pr.files.some((f) => f.changeType === 'RENAMED'))
			continue;
		pr.files = await allPullFiles(`repos/${repo}/pulls/${pr.number}`, pr, request, signal);
	}
	return pulls.sort((a, b) => a.number - b.number);
}

async function allPullFiles(
	endpoint: string,
	pr: AreaPull,
	request: ReturnType<typeof trackerGithubRequest>,
	signal: AbortSignal
) {
	const reply = await request(
		['api', '--hostname', 'github.com', '--paginate', '--slurp', `${endpoint}/files?per_page=100`],
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
	return files.flatMap((f) =>
		[f.filename, ...(f.previous_filename ? [f.previous_filename] : [])].map((path) => ({
			path,
			changeType: 'CHANGED'
		}))
	);
}
