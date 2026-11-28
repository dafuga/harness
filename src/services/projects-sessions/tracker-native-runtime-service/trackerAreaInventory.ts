// @harness-uid u_bl6xl2h4a3
import { TrackerHostProcessError } from '../../../adapters/projects-sessions/tracker-host-process-adapter/TrackerHostProcessError';
import { basename } from 'node:path';
import { stat } from 'node:fs/promises';
import { runTrackerHostCommand } from '../../../adapters/projects-sessions/tracker-host-process-adapter/trackerHostCommand';
import { areaClaim, areaIntersects } from '../tracker-hub-sync/trackerAreaClaim';
import { openAreaPulls, openPullWarning } from './trackerAreaPulls';
import type { AreaPull, OpenPulls } from './trackerAreaPulls.types';
import type { TrackerHostRepository } from './nativeTrackerHostEffects.types';

const maxAreas = 512;
const links = /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)\b/gi;
const shortLink = /\bPR\s*#(\d+)\b/gi;

/**
 * Only Areas lines and claimed paths are declarations. Tracked names and linked pull request
 * paths are guesses: they are compared for warnings and never hold another session.
 */
export function intendedAreas(
	text: string,
	tracked: string[],
	linked: AreaPull[],
	extra: string[] = []
) {
	const lines = [...text.matchAll(/^\s*areas:\s*(.+)$/gim)].flatMap(([, value]) =>
		value.split(',').map((s) => s.trim().replace(/\/$/, ''))
	);
	const stated = usablePaths([...extra, ...lines]);
	const names = new Set(text.match(/[\w./-]+/g) ?? []);
	const mentioned = tracked.filter(
		(path) =>
			names.has(path) ||
			names.has(basename(path)) ||
			names.has(basename(path).replace(/\.[^.]+$/, ''))
	);
	const guessed = usablePaths([
		...linked.flatMap((pr) => pr.files.map((f) => f.path)),
		...mentioned
	]);
	const declared = stated.paths.slice(0, maxAreas);
	const inferred = guessed.paths.filter((path) => !declared.includes(path));
	const warnings = [
		stated.invalid.length &&
			'Ignored invalid declared areas: ' +
				stated.invalid.slice(0, 5).map((path) => JSON.stringify(path.slice(0, 80))),
		stated.paths.length > maxAreas &&
			`More than ${maxAreas} areas are declared; only the first ${maxAreas} are claimed`,
		inferred.length > maxAreas &&
			`The item mentions ${inferred.length} paths; only the first ${maxAreas} were compared`
	].filter((warning) => typeof warning === 'string');
	return { declared, inferred: inferred.slice(0, maxAreas), warnings };
}

function usablePaths(candidates: string[]) {
	const unique = [...new Set(candidates.filter(Boolean))];
	const usable = (path: string) => areaClaim.shape.areas.element.safeParse(path).success;
	return { paths: unique.filter(usable), invalid: unique.filter((path) => !usable(path)) };
}

/** Keep credentials and repository URLs out of diagnostics. Only a configured checkout is scanned. */
export async function trackerAreaInventory(
	route: TrackerHostRepository,
	text: string,
	signal: AbortSignal,
	{ project = basename(route.repo), extra = [] }: { project?: string; extra?: string[] } = {}
) {
	const { tracked, repo, unrecognised } = await checkoutIdentity(route, signal);
	const open: OpenPulls = repo ? await openAreaPulls(route, repo, signal) : { pulls: [] };
	const refs = repo ? linkedPulls(text, repo) : new Set<number>();
	const { declared, inferred, warnings } = intendedAreas(
		text,
		tracked,
		open.pulls.filter((p) => refs.has(p.number)),
		extra
	);
	const compared = [...declared, ...inferred];
	const siblings = open.pulls.filter((pr) =>
		pr.files.some(({ path }) => compared.some((a) => areaIntersects(a, path)))
	);
	if (unrecognised)
		warnings.push(
			'The origin is not a recognised GitHub remote, so pull requests were not checked'
		);
	warnings.push(...pullWarnings(open, compared, repo ? { repo, siblings } : undefined));
	return {
		repo: repo ?? 'workspace/' + project.toLowerCase(),
		areas: declared,
		inferred,
		siblings,
		warnings
	};
}

function pullWarnings(
	open: OpenPulls,
	compared: string[],
	found?: { repo: string; siblings: AreaPull[] }
) {
	if (open.warning) return [open.warning];
	if (open.pulls.length && !compared.length)
		return ['No areas are declared or inferred, so open pull requests were not compared'];
	return found?.siblings.length ? [openPullWarning(found.repo, found.siblings)] : [];
}

async function checkoutIdentity(route: TrackerHostRepository, signal: AbortSignal) {
	const git = checkoutReader(route, signal);
	const tracked = await checkoutPaths(route, git, signal);
	const remotes = tracked ? (await git(['remote'])).split('\n').filter(Boolean) : [];
	const repo = remotes.includes('origin')
		? githubRepository(await git(['remote', 'get-url', 'origin']))
		: undefined;
	return { tracked: tracked ?? [], repo, unrecognised: remotes.length > 0 && !repo };
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
	return /^(?:git@github\.com:|https:\/\/github\.com\/|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i
		.exec(remote)?.[1]
		?.toLowerCase();
}
