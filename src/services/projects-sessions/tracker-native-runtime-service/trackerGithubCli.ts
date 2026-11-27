// @harness-uid u_bl6xl2h4a3
import { realpathSync, statSync } from 'node:fs';
import { TrackerHostProcessError } from '../../../adapters/projects-sessions/tracker-host-process-adapter/TrackerHostProcessError';
import {
	controlledTrackerExecutable,
	runTrackerHostCommand
} from '../../../adapters/projects-sessions/tracker-host-process-adapter/trackerHostCommand';
import type { TrackerGithubAdapterProvider } from '../TrackerAdapterPollService.types';
import {
	adapterComments,
	adapterIssue,
	adapterIssues,
	adapterTimeline
} from './trackerHostAdapterSchema';

const tracked = 'tracked';
const githubHost = 'github.com';

export function trackerGithubCli(binding: {
	executable: string;
	configDirectory: string;
}): TrackerGithubAdapterProvider {
	const gh = trackerGithubRequest(binding);
	const request = (args: string[], signal: AbortSignal) =>
		gh(['api', '--hostname', githubHost, ...args], signal);
	const read = async (endpoint: string, signal: AbortSignal): Promise<unknown[]> => {
		const reply = await request(['--method', 'GET', '--paginate', '--slurp', endpoint], signal);
		if (reply.code !== 0) throw new TrackerHostProcessError('Tracker GitHub read failed');
		const pages: unknown = JSON.parse(reply.stdout);
		if (!Array.isArray(pages) || !pages.every(Array.isArray))
			throw new TypeError('Invalid Tracker GitHub pages');
		return pages.flat();
	};
	return {
		async *readIssues({ target }, { since, backfill, signal }) {
			const base = `repos/${target}/issues`;
			const recent = adapterIssues.parse(
				await read(`${base}?state=all&since=${githubTime(since)}&per_page=100`, signal)
			);
			const older = backfill
				? adapterIssues.parse(await read(`${base}?state=open&per_page=100`, signal))
				: [];
			yield* new Map([...older, ...recent].map((issue) => [issue.id, issue])).values();
		},
		readIssue: ({ target }, issue, signal) => readTrackerIssue(request, { target, issue }, signal),
		async readTimeline({ target }, issue, signal) {
			return adapterTimeline.parse(
				await read(`repos/${target}/issues/${issue}/timeline?per_page=100`, signal)
			);
		},
		async *readComments({ target }, { since, signal }) {
			yield* adapterComments.parse(
				await read(
					`repos/${target}/issues/comments?since=${githubTime(since)}&per_page=100`,
					signal
				)
			);
		},
		markTracked: (source, issue, signal) =>
			markTrackedIssue(request, { target: source.target, issue }, signal)
	};
}

export function trackerGithubRequest(binding: { executable: string; configDirectory: string }) {
	const executable = controlledTrackerExecutable(binding.executable);
	const environment = {
		GH_CONFIG_DIR: privateGithubDirectory(binding.configDirectory),
		GH_PROMPT_DISABLED: '1',
		GH_NO_UPDATE_NOTIFIER: '1',
		GH_NO_EXTENSION_UPDATE_NOTIFIER: '1'
	};
	return (args: string[], signal: AbortSignal) =>
		runTrackerHostCommand(executable, args, signal, {
			environment
		});
}

async function readTrackerIssue(
	request: (
		args: string[],
		signal: AbortSignal
	) => Promise<{ code: number; stdout: string; stderr: string }>,
	{ target, issue }: { target: string; issue: string },
	signal: AbortSignal
) {
	if (!/^[1-9][0-9]{0,9}$/.test(issue)) throw new TypeError('Invalid Tracker issue number');
	const reply = await request(['--method', 'GET', `repos/${target}/issues/${issue}`], signal);
	if (reply.code === 0) return adapterIssue.parse(JSON.parse(reply.stdout));
	if (/\bHTTP (?:404|410)\b/.test(reply.stderr)) return undefined;
	throw new TrackerHostProcessError('Tracker GitHub issue lookup failed');
}

function privateGithubDirectory(path: string): string {
	const canonical = realpathSync(path);
	const stat = statSync(canonical);
	if (!stat.isDirectory() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0)
		throw new TypeError(
			'Tracker GitHub config needs a private directory owned by the service user'
		);
	return canonical;
}

function githubTime(since: number): string {
	return encodeURIComponent(new Date(Math.max(0, since)).toISOString());
}

async function createTrackerLabel(
	request: (args: string[], signal: AbortSignal) => Promise<{ code: number }>,
	{ base, response }: { base: string; response: string },
	signal: AbortSignal
): Promise<void> {
	if (!/\bHTTP 404\b/.test(response))
		throw new TrackerHostProcessError('Tracker GitHub label lookup failed');
	const created = await request(
		['--method', 'POST', `${base}/labels`, '-f', `name=${tracked}`, '-f', 'color=1d76db'],
		signal
	);
	if (created.code === 0) return;
	const existing = await request([`${base}/labels/${encodeURIComponent(tracked)}`], signal);
	if (existing.code !== 0)
		throw new TrackerHostProcessError('Tracker GitHub label creation failed');
}

async function markTrackedIssue(
	request: (args: string[], signal: AbortSignal) => Promise<{ code: number; stderr: string }>,
	{ target, issue }: { target: string; issue: string },
	signal: AbortSignal
): Promise<void> {
	if (!/^[1-9][0-9]{0,9}$/.test(issue)) throw new TypeError('Invalid Tracker issue number');
	const base = `repos/${target}`;
	const label = await request([`${base}/labels/${encodeURIComponent(tracked)}`], signal);
	if (label.code !== 0) await createTrackerLabel(request, { base, response: label.stderr }, signal);
	const written = await request(
		['--method', 'POST', `${base}/issues/${issue}/labels`, '-f', `labels[]=${tracked}`],
		signal
	);
	if (written.code !== 0)
		throw new TrackerHostProcessError('Tracker GitHub label was not acknowledged');
}
