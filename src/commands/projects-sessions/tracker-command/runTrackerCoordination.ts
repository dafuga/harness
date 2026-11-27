// @harness-uid u_r7qgepnoax
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { TrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import { fetchNativeTracker } from './fetchNativeTracker';
import { trackerLandingGit } from './trackerLandingGit';
import { trackerLandPull, reconcileLanding } from './trackerLandPull';

export function isTrackerCoordinationCommand(verb: string) {
	return verb === 'land' || verb === 'claim';
}

export async function runTrackerCoordination(args: string[], config: TrackerNodeConfig) {
	const [action, id, ...words] = args;
	try {
		if (!id || !words.length)
			throw new ExpectedCliError('Usage: tracker claim ITEM PATH... or tracker land ITEM PR');
		if (action === 'claim') {
			const reply = await claim(config, id, words);
			console.log(reply.reason);
			return reply.allowed ? 0 : 1;
		}
		await land(config, id, words);
		return 0;
	} catch (error) {
		console.error(error instanceof Error ? error.message : 'Tracker coordination failed');
		return 1;
	}
}

async function send(config: TrackerNodeConfig, command: string, body: Record<string, unknown>) {
	const reply = await fetchNativeTracker(
		config,
		{ method: 'POST', path: '/coordination/' + command, body },
		config.node
	);
	const result = z
		.object({
			allowed: z.boolean(),
			reason: z.string(),
			pinned: z
				.object({
					ticket: z.uuid(),
					head: z.string().regex(/^[0-9a-f]{40}$/),
					base: z.string().regex(/^[0-9a-f]{40}$/)
				})
				.optional()
		})
		.safeParse(await reply.json());
	if (!result.success)
		throw new ExpectedCliError('Tracker coordination is unavailable on this node');
	return result.data;
}

async function claim(config: TrackerNodeConfig, id: string, words: string[]) {
	const identity =
		process.env.CODEX_THREAD_ID ??
		process.env.CLAUDE_SESSION_ID ??
		process.env.TMUX_PANE ??
		String(process.ppid);
	const run = process.env.TRACKER_RUN_ID;
	return send(config, 'claim', {
		id,
		areas: words,
		session: createHash('sha256').update(identity).digest('hex'),
		...(run && { run: Number(run) })
	});
}

async function land(config: TrackerNodeConfig, id: string, words: string[]) {
	const reconcile = words.length === 2 && words[1] === '--reconcile';
	if ((!reconcile && words.length !== 1) || !/^[1-9]\d{0,9}$/.test(words[0]))
		throw new ExpectedCliError('Usage: tracker land ITEM PR');
	const controller = new AbortController();
	const abort = () => controller.abort();
	process.once('SIGINT', abort);
	process.once('SIGTERM', abort);
	try {
		console.log(
			await (reconcile ? reconcileLanding : trackerLandPull)(
				{ id, pr: Number(words[0]) },
				(req) => send(config, 'landing', { ...req }),
				trackerLandingGit(process.cwd(), controller.signal),
				controller.signal
			)
		);
	} finally {
		process.off('SIGINT', abort);
		process.off('SIGTERM', abort);
	}
}
