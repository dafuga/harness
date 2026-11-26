import { DatabaseSync } from 'node:sqlite';
import { projectRow } from '../../packages/desktop/src/lib/development-tooling/desktop-initialization/macTrackerInboxProjection';
import { buildHomeSnapshot } from '../../packages/reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { readTrackerSources } from '../../packages/reports/src/lib/projects-sessions/project-overview/projectOverviewTracker';
import type { TrackerItem } from '../../src/repositories/projects-sessions/TrackerItemReadRepository.types';
import { phoneReplicaRows } from '../../src/services/projects-sessions/tracker-phone-replica-service/phoneReplicaRows';
import { finishedTrackerProcess, fixtureTrackerJson, loopback } from './trackerNodeProcess';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';

/** Every place a Daniel ask is read from one running Tracker: true where it lists the item. */
export async function trackerNeedsYouViews(hub: TrackerNodeFixture, id: string) {
	const digest = await fixtureTrackerJson(hub, ['digest']);
	const text = (await finishedTrackerProcess(hub, ['digest'])).stdout;
	const flagged: { id: string }[] = await fixtureTrackerJson(hub, ['list', '--flagged']);
	const has = (rows: { id: string }[]) => rows.some((row) => row.id === id);
	return {
		listFlagged: has(flagged),
		digestDecisions: has(digest.daniel_decisions),
		digestToUnblock: has(digest.to_unblock),
		digestText: text.includes(`[${id.slice(0, 6)}]`),
		...(await appViews(hub, id)),
		phone: phoneAsk(hub, id)
	};
}

/** What the Hub and the Mac app build from the same loopback reads they make in production. */
async function appViews({ config }: TrackerNodeFixture, id: string) {
	const local: typeof fetch = (url, init) =>
		fetch(String(url).replace(loopback(7701), loopback(config.apiPort)), init);
	const home = buildHomeSnapshot(
		await readTrackerSources(local, true),
		{ routines: null, quota: null },
		Date.now()
	);
	const reply = await local(`${loopback(7701)}/items?status=all&limit=-1`);
	const item = ((await reply.json()) as TrackerItem[]).find((row) => row.id === id);
	const projects = home.overview.status === 'ready' ? home.overview.projects : [];
	return {
		hubOpenAsks: home.openAsks.some((ask) => ask.itemId === id),
		hubProjectNeedsYou: projects.some((project) => project.state === 'needs-you'),
		macInbox: Boolean(item) && projectRow(item!).bucket === 'needs-you'
	};
}

/** The phone feed row carries answerable options only for an open structured ask. */
function phoneAsk({ config }: TrackerNodeFixture, id: string): boolean {
	const database = new DatabaseSync(config.database, { readOnly: true });
	try {
		const rows = phoneReplicaRows(database, config.node, Date.now());
		const flag = rows.find((row) => row.id === id)?.flag;
		return flag?.state === 'open' && Boolean(flag.options?.length);
	} finally {
		database.close();
	}
}
