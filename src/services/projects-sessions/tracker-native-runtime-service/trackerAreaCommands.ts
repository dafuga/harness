// @harness-uid u_bl6xl2h4a3
import type { Item, Attempt } from './trackerAreaCommands.types';
import { z } from 'zod';
import { createTrackerSpokeRequester } from '../TrackerSpokeSyncService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import {
	areaClaim,
	areaDecision,
	trackerAreaAuthority
} from '../tracker-hub-sync/trackerAreaClaim';
import type { AreaDecision } from '../tracker-hub-sync/trackerAreaClaim.types';
import { TrackerHostProcessError } from '../../../adapters/projects-sessions/tracker-host-process-adapter/TrackerHostProcessError';
import {
	landingDecision,
	landingRequest,
	trackerLandingAuthority
} from '../tracker-hub-sync/trackerLandingQueue';
import { trackerAreaInventory } from './trackerAreaInventory';

const claimRequest = z.strictObject({
	id: z.string(),
	areas: areaClaim.shape.areas.min(1),
	run: z.int().positive().optional(),
	session: z.string().regex(/^[a-f0-9]{64}$/)
});
function authorityPort(store: TrackerPersistenceService, options: TrackerNativeRuntimeOptions) {
	if (options.role === 'hub') {
		const claim = trackerAreaAuthority(store);
		const landing = trackerLandingAuthority(store, options.now);
		return {
			claim: async (input: unknown) => claim(input, store.node),
			landing: async (input: unknown) => landing(input, store.node)
		};
	}
	const post = hubSender(store, options);
	return {
		claim: async (input: unknown) => {
			if (!post) throw new TrackerHostProcessError('This computer has no Tracker hub link');
			return areaDecision.parse(await post('area-claim', input));
		},
		landing: async (input: unknown) => {
			if (!post) return { allowed: false, reason: 'Waiting for the Tracker hub authority' };
			return landingDecision.parse(await post('landing', input));
		}
	};
}
function hubSender(store: TrackerPersistenceService, options: TrackerNativeRuntimeOptions) {
	const hub = options.links?.find(({ link }) => (link ?? 'hub') === 'hub');
	if (!hub) return undefined;
	const send = createTrackerSpokeRequester({
		...hub,
		store,
		transport: (r) => hub.transport(r, AbortSignal.timeout(10000))
	});
	return (kind: 'area-claim' | 'landing', input: unknown) =>
		send({ method: 'POST', pathAndQuery: '/sync/' + kind, body: JSON.stringify(input) }, 10000);
}
const unchecked =
	'Chief of Staff: verify the checkout and Tracker hub; declared areas were not checked or recorded';
function unrecorded(reason: string, warnings: string[] = []): AreaDecision {
	return { allowed: true, recorded: false, reason, warnings };
}
/** Only the hub's declared-area verdict can hold. A check that cannot run starts with a warning. */
function claimInspector(
	options: TrackerNativeRuntimeOptions,
	claim: ReturnType<typeof authorityPort>['claim'],
	history: (id: string) => string
) {
	const routes = Object.entries(options.hostEffects?.launch?.repositories ?? {});

	return async (item: Item, attempt: Attempt, extra: string[] = []) => {
		const project = item.project ?? item.agent ?? undefined;
		const route = project
			? routes.find(([key]) => key.toLowerCase() === project.toLowerCase())
			: routes.find(([, route]) => route.repo === item.repo);
		if (!route) return unrecorded('Operations workdir has no repository claim');
		const found: string[] = [];
		try {
			const { repo, areas, inferred, warnings } = await trackerAreaInventory(
				route[1],
				[item.title, item.notes, history(item.id)].join('\n'),
				AbortSignal.timeout(30000),
				{ project: route[0], extra }
			);
			found.push(...warnings);
			const request = { repo, areas, inferred, project: route[0], id: item.id, ...attempt };
			const decision = await claim(request);
			return { ...decision, warnings: [...found, ...decision.warnings] };
		} catch {
			return unrecorded('Area overlap was not fully checked', [...found, unchecked]);
		}
	};
}
export function trackerAreaCommands(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions
) {
	const authority = authorityPort(store, options);
	const journal = store.database.prepare(
		'SELECT text FROM item_notes WHERE item_id=? ORDER BY hlc'
	);
	const history = (id: string) =>
		(journal.all(id) as { text: string }[])
			.map((n) => n.text)
			.filter(
				(text) =>
					!/^(Area claim on |watchdog |auto-launch |Confirmed run stop|Landing [\w.-]+\/)/i.test(
						text
					)
			)
			.join('\n');
	const inspect = claimInspector(options, authority.claim, history);
	const items = new TrackerItemReadRepository(store.database);
	return {
		history,
		inspect,
		commands: {
			async landing(input: unknown) {
				const req = landingRequest.parse(input);
				req.id = items.resolve(req.id).id;
				return authority.landing(req);
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
				const decision = await inspect(
					{ ...item, title: item.title ?? '' },
					run ?? { token: 'manual:' + req.session, attempt: 1 },
					req.areas
				);
				// A claim command succeeds only when its paths are actually held.
				return {
					allowed: decision.allowed && decision.recorded,
					reason: [decision.reason, ...decision.warnings].join('\n')
				};
			}
		}
	};
}
