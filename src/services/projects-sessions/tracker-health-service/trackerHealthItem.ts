// @harness-uid u_s4ztf7hn2i
import type { TrackerNodeConfig } from '../tracker-node-service/trackerNodeConfig.types';
import type { TrackerHealthReport } from '../TrackerHealthService.types';
import { trackerHealthRequest } from './trackerHealthApi';
import type { TrackerHealthState } from './trackerHealthState.types';

const options = [
	{
		label: 'Send a session to fix it',
		effect: 'Chief of Staff launches a session to find the cause and restore Tracker health',
		recommended: true
	},
	{ label: 'Leave it for now', effect: 'The failure stays; this repeats daily until it passes' }
];

/** Keep one health item per node. An ignored item stays ignored. */
export async function raiseTrackerHealthItem(
	config: TrackerNodeConfig,
	report: TrackerHealthReport,
	state: TrackerHealthState
): Promise<void> {
	const failures = report.failing
		.filter(({ name }) => name !== 'backup')
		.map(({ name, detail }) => `${name}: ${detail}`)
		.join(' | ');
	const question = `Tracker health on ${config.node} is failing: ${failures}`.slice(0, 1500);
	const ask = { question, options, force: true };
	const { item_id: id } = state;
	const status = id ? (await item(config, `/items/${id}`)).status : undefined;
	if (status === 'ignored') return;
	if (id && status) {
		if (status === 'done') await item(config, `/items/${id}/reopen`, {});
		await item(config, `/items/${id}/flag`, ask);
	} else {
		const created = await item(config, '/items', {
			...ask,
			title: `Tracker health on ${config.node} (automatic check)`,
			agent: 'tracker',
			owner: 'tracker health',
			needs_daniel: true,
			later: true
		});
		if (!created.id) throw new TypeError('Tracker health item was refused');
		state.item_id = created.id;
	}
	state.item_open = true;
}

export async function recoverTrackerHealthItem(
	config: TrackerNodeConfig,
	report: TrackerHealthReport,
	state: TrackerHealthState
): Promise<void> {
	const path = `/items/${state.item_id}`;
	const { status } = await item(config, path);
	if (status && status !== 'done' && status !== 'ignored') {
		const text = `recovered at ${report.at}: all checks pass`;
		await item(config, `${path}/note`, { text });
		await item(config, `${path}/unflag`, {});
		await item(config, `${path}/done`, { note: text, force: true });
	}
	state.item_open = false;
}

async function item(config: TrackerNodeConfig, path: string, body?: object) {
	return (await trackerHealthRequest(config, path, body)) as { id?: string; status?: string };
}
