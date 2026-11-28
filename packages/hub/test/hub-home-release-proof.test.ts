import { expect, test } from 'vitest';
import { verifyHubHomeRelease } from '../scripts/verify-home-release';

const nodes = ['primary-mac', 'second-mac'];
const first = { id: 12, node: nodes[0], item_id: 'working', state: 'running', ended_at: null };
const second = { ...first, node: nodes[1] };
const current = [
	first,
	second,
	second,
	{ ...first, id: 13, node: 'unlinked-mac' },
	{ ...first, id: 14, state: 'queued' },
	{ ...first, id: 15, ended_at: 1000 },
	{ ...first, id: 16, item_id: 'private' },
	{ ...first, id: 17, item_id: 'family-reminder' }
];

function tracker(before = current, after = before) {
	let sampled = false;
	return async (url: string) => {
		if (url === 'http://127.0.0.1:7701/runs?limit=10000') {
			const runs = sampled ? after : before;
			sampled = true;
			return Response.json(runs);
		}
		if (url === 'http://127.0.0.1:7701/items?status=all&limit=-1') {
			return Response.json([
				{ id: 'working', agent: 'project', status: 'in_progress', needs_daniel: true },
				{ id: 'private', agent: 'project', status: 'in_progress', sensitive: true },
				{ id: 'family-reminder', agent: 'family', status: 'in_progress' }
			]);
		}
		return new Response(null, { status: 404 });
	};
}

test('accepts an exact session count across Macs with a working agent also needing attention', async () => {
	const result = await verifyHubHomeRelease(
		nodes,
		async () => '1 working (2 sessions) · 0 idle or offline',
		tracker()
	);
	expect(result).toMatchObject({
		home: { working: 1, sessions: 2 },
		tracker: nodes.map((node) => ({ node, sessions: 1 })),
		total: 2
	});
});

test.each([
	['0 working · 18 idle or offline', 'Home reports 0 working while Tracker has 2 live sessions'],
	['1 working (1 session) · 0 idle or offline', 'Home reports 1 session(s), Tracker has 2'],
	['1 working (3 sessions) · 0 idle or offline', 'Home reports 3 session(s), Tracker has 2']
])('rejects the rendered mismatch %s', async (summary, message) => {
	await expect(verifyHubHomeRelease(nodes, async () => summary, tracker())).rejects.toThrow(
		message
	);
});

test('rejects a sample without live runs even when the Agents card also shows zero', async () => {
	await expect(
		verifyHubHomeRelease(nodes, async () => '0 working · 1 idle or offline', tracker([]))
	).rejects.toThrow('No eligible live Tracker runs');
});

test('requires a fresh observation when one run replaces another during the browser check', async () => {
	await expect(
		verifyHubHomeRelease(
			nodes,
			async () => '1 working (1 session) · 0 idle or offline',
			tracker([first], [{ ...first, id: 42 }])
		)
	).rejects.toThrow('Tracker runs changed during the browser observation');
});

test('rejects an unsettled Agents card and an unavailable Tracker', async () => {
	await expect(
		verifyHubHomeRelease(nodes, async () => 'Loading agents…', tracker())
	).rejects.toThrow('Enter the settled Agents card summary');
	await expect(
		verifyHubHomeRelease(
			nodes,
			async () => '0 working · 1 idle or offline',
			async () => new Response(null, { status: 503 })
		)
	).rejects.toThrow('Tracker read failed');
});
