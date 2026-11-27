import { createInterface } from 'node:readline/promises';
import { z } from 'zod';
import { trackerPersonalAgent } from '../../../src/utils/projects-sessions/trackerUnattendedHold';
import type { TrackerFetch } from './verify-home-release.types';

const trackerOrigin = 'http://127.0.0.1:7701';
const runLimit = 10000;
const trackerRuns = z.array(
	z.object({
		id: z.number().int(),
		node: z.string().min(1).nullable(),
		item_id: z.string().min(1),
		state: z.string().min(1),
		ended_at: z.number().nullable()
	})
);
const trackerItems = z.array(
	z.object({
		id: z.string().min(1),
		agent: z.string().nullable().optional(),
		status: z.enum(['open', 'in_progress', 'blocked', 'done', 'ignored']),
		deleted: z.boolean().optional(),
		sensitive: z.boolean().optional()
	})
);

async function readTracker(path: string, fetcher: TrackerFetch): Promise<unknown> {
	try {
		const response = await fetcher(trackerOrigin + path, {
			cache: 'no-store',
			credentials: 'omit',
			redirect: 'error',
			signal: AbortSignal.timeout(5000)
		});
		if (response.ok) return await response.json();
	} catch {
		// Tracker sometimes returns private fields. Keep parse and transport details out of evidence.
	}
	throw new Error(`Tracker read failed for ${path}.`);
}

async function readTrackerSnapshot(fetcher: TrackerFetch) {
	const [runs, items] = await Promise.all([
		readTracker(`/runs?limit=${runLimit}`, fetcher).then((rows) => trackerRuns.safeParse(rows)),
		readTracker('/items?status=all&limit=-1', fetcher).then((rows) => trackerItems.safeParse(rows))
	]);
	if (!runs.success || !items.success) throw new Error('Tracker returned invalid runs or items.');
	if (runs.data.length >= runLimit) throw new Error('Tracker run sample may be truncated.');
	return { runs: runs.data, items: items.data };
}

async function sampleTracker(nodes: string[], fetcher: TrackerFetch) {
	const { runs, items } = await readTrackerSnapshot(fetcher);
	const live = new Map(nodes.map((node) => [node, new Set<number>()]));
	const byId = new Map(items.map((item) => [item.id, item]));
	const running = runs.filter((run) => run.state === 'running' && run.ended_at === null);
	for (const run of running) {
		if (!run.node) throw new Error('A live Tracker run has no computer.');
		const node = live.get(run.node);
		if (!node) continue;
		const item = byId.get(run.item_id);
		if (!item) throw new Error('A live Tracker run has no matching item. Check Tracker sync.');
		if (
			!item.deleted &&
			!item.sensitive &&
			item.status !== 'ignored' &&
			item.agent &&
			!trackerPersonalAgent(item.agent)
		) {
			node.add(run.id);
		}
	}
	return {
		at: new Date().toISOString(),
		byNode: Array.from(live, ([node, ids]) => ({ node, ids: [...ids].sort((a, b) => a - b) }))
	};
}

function parseAgentsSummary(summary: string) {
	const match = /^(\d+) working(?: \((\d+) sessions?\))? · \d+ idle or offline$/.exec(
		summary.trim()
	);
	if (!match) throw new Error('Enter the settled Agents card summary from signed-in Home.');
	return { working: Number(match[1]), sessions: Number(match[2] ?? 0) };
}

export async function verifyHubHomeRelease(
	nodes: string[],
	readSummary: () => Promise<string>,
	fetcher: TrackerFetch = fetch
) {
	if (!nodes.length || nodes.some((node) => !/^[\w.-]+$/.test(node))) {
		throw new Error('Supply the Tracker node name of each online Mac in scope.');
	}
	const scope = [...new Set(nodes)].sort();
	const before = await sampleTracker(scope, fetcher);
	const home = parseAgentsSummary(await readSummary());
	const after = await sampleTracker(scope, fetcher);
	if (JSON.stringify(before.byNode) !== JSON.stringify(after.byNode)) {
		throw new Error('Tracker runs changed during the browser observation. Repeat the check.');
	}
	const tracker = after.byNode.map(({ node, ids }) => ({ node, sessions: ids.length }));
	const total = tracker.reduce((sum, { sessions }) => sum + sessions, 0);
	if (!total) throw new Error('No eligible live Tracker runs. Repeat when there is active work.');
	if (home.working === 0) {
		throw new Error(`Home reports 0 working while Tracker has ${total} live sessions.`);
	}
	if (home.sessions !== total) {
		throw new Error(`Home reports ${home.sessions} session(s), Tracker has ${total}.`);
	}
	return { from: before.at, to: after.at, home, tracker, total };
}

if (import.meta.main) {
	try {
		const result = await verifyHubHomeRelease(process.argv.slice(2), async () => {
			const input = createInterface({ input: process.stdin, output: process.stdout });
			try {
				return await input.question('Reload signed-in Home and enter the settled Agents summary: ');
			} finally {
				input.close();
			}
		});
		console.log(JSON.stringify(result, null, 2));
		console.log('PASS: Hub Home live Tracker counts.');
	} catch (error) {
		console.error(
			'FAIL:',
			error instanceof Error ? error.message : 'Hub Home release check failed.'
		);
		process.exitCode = 1;
	}
}
