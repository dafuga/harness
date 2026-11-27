// @harness-uid u_bl6xl2h4a3
import { z } from 'zod';
import { createTrackerSpokeRequester } from '../TrackerSpokeSyncService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerDispatchItem } from '../../agents-providers/TrackerDispatcherService.types';
import { areaClaim, trackerAreaAuthority } from '../tracker-hub-sync/trackerAreaClaim';
import { landingRequest, trackerLandingAuthority } from '../tracker-hub-sync/trackerLandingQueue';
import { trackerAreaInventory } from './trackerAreaInventory';

const claimRequest = z.strictObject({
	id: z.string(),
	areas: areaClaim.shape.areas,
	run: z.int().positive().optional(),
	session: z.string().regex(/^[a-f0-9]{64}$/)
});
const reply = z.object({
	allowed: z.boolean(),
	reason: z.string(),
	pinned: z
		.object({
			ticket: z.uuid(),
			head: z.string().regex(/^[0-9a-f]{40}$/),
			base: z.string().regex(/^[0-9a-f]{40}$/)
		})
		.optional()
});
type Item = Pick<TrackerDispatchItem, 'id' | 'title' | 'notes' | 'project' | 'agent' | 'repo'>;
type Attempt = { token: string; attempt: number };
function authorityPort(store: TrackerPersistenceService, options: TrackerNativeRuntimeOptions) {
	if (options.role === 'hub') {
		const claim = trackerAreaAuthority(store);
		const landing = trackerLandingAuthority(store, options.now);
		return async (kind: 'area-claim' | 'landing', input: unknown) =>
			(kind === 'area-claim' ? claim : landing)(input, store.node);
	}
	const hub = options.links?.find(({ link }) => (link ?? 'hub') === 'hub');
	const send =
		hub &&
		createTrackerSpokeRequester({
			...hub,
			store,
			transport: (r) => hub.transport(r, AbortSignal.timeout(10000))
		});
	return async (kind: 'area-claim' | 'landing', input: unknown) => {
		if (!send) return { allowed: false, reason: 'Waiting for the Tracker hub authority' };
		return reply.parse(
			await send(
				{ method: 'POST', pathAndQuery: '/sync/' + kind, body: JSON.stringify(input) },
				10000
			)
		);
	};
}
function claimInspector(
	options: TrackerNativeRuntimeOptions,
	send: ReturnType<typeof authorityPort>
) {
	const routes = Object.entries(options.hostEffects?.launch?.repositories ?? {});

	return async (item: Item, attempt: Attempt, extra: string[] = []) => {
		const project = item.project ?? item.agent ?? undefined;
		const route = project
			? routes.find(([key]) => key.toLowerCase() === project.toLowerCase())
			: routes.find(([, route]) => route.repo === item.repo);
		if (!route)
			return { allowed: extra.length === 0, reason: 'Operations workdir has no repository claim' };
		try {
			const inspection = await trackerAreaInventory(
				route[1],
				[item.title, item.notes].join('\n'),
				AbortSignal.timeout(30000),
				{ project: route[0], extra }
			);
			const { repo, areas, siblings } = inspection;
			if (siblings.length)
				return {
					allowed: false,
					reason:
						'Land after ' +
						siblings
							.map(
								(pr) =>
									`${repo}#${pr.number} (${pr.author?.login ?? 'unknown owner'}, ${pr.headRefName})`
							)
							.join(', ')
				};
			return await send('area-claim', { repo, areas, project: route[0], id: item.id, ...attempt });
		} catch {
			return {
				allowed: false,
				reason:
					'Chief of Staff: verify the checkout, GitHub PR read binding and Tracker hub before launching'
			};
		}
	};
}
export function trackerAreaCommands(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions
) {
	const authority = authorityPort(store, options);
	const inspect = claimInspector(options, authority);
	const items = new TrackerItemReadRepository(store.database);
	return {
		inspect,
		commands: {
			async landing(input: unknown) {
				const req = landingRequest.parse(input);
				req.id = items.resolve(req.id).id;
				return authority('landing', req);
			},
			async claim(input: unknown) {
				const req = claimRequest.parse(input);
				const item = items.resolve(req.id);
				const run = req.run
					? (store.database
							.prepare(
								"SELECT auto_token AS token, attempt FROM runs WHERE id=? AND item_id=? AND state IN ('queued','running','verifying')"
							)
							.get(req.run, item.id) as Attempt | undefined)
					: undefined;
				if (req.run && !run) return { allowed: false, reason: 'run does not own this item' };
				return inspect(
					{ ...item, title: item.title ?? '' },
					run ?? { token: 'manual:' + req.session, attempt: 1 },
					req.areas
				);
			}
		}
	};
}
