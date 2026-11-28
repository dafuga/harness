// @harness-uid u_bxb55zfvqw
import type { TrackerLocalApiService } from '../TrackerLocalApiService';
import { readTrackerBackupState, writeTrackerBackupState } from './trackerBackupState';

const title = 'Tracker backups need attention';
const options = [
	{
		label: 'Send a session to fix backups',
		effect: 'Chief of Staff launches a session to find the cause and take a verified backup',
		recommended: true
	},
	{ label: 'Leave it for now', effect: 'No new verified native backup until one succeeds' }
];

/** Keep at most one open ask about backups. An ignored ask stays ignored. */
export async function raiseTrackerBackupAlert(
	items: TrackerLocalApiService,
	stateFile: string,
	question: string
): Promise<void> {
	const { alert_item: id } = readTrackerBackupState(stateFile);
	const status = id ? (await send(items, 'GET', `/items/${id}`)).status : undefined;
	if (status === 'ignored') return;
	const ask = { question, options };
	if (id && status && status !== 'done') {
		await send(items, 'POST', `/items/${id}/flag`, ask);
		return;
	}
	const created = await send(items, 'POST', '/items', {
		...ask,
		title,
		agent: 'tracker',
		owner: 'tracker backups',
		needs_daniel: true,
		later: true,
		force: true
	});
	if (!created.id) throw new TypeError(`Tracker backup alert was refused: ${created.error}`);
	writeTrackerBackupState(stateFile, { alert_item: created.id });
}

export async function clearTrackerBackupAlert(
	items: TrackerLocalApiService,
	stateFile: string,
	note: string
): Promise<void> {
	const { alert_item: id } = readTrackerBackupState(stateFile);
	if (!id) return;
	const { status } = await send(items, 'GET', `/items/${id}`);
	if (status && status !== 'done' && status !== 'ignored') {
		await send(items, 'POST', `/items/${id}/unflag`);
		await send(items, 'POST', `/items/${id}/done`, { note, force: true });
	}
	writeTrackerBackupState(stateFile, { alert_item: null });
}

async function send(
	items: TrackerLocalApiService,
	method: string,
	path: string,
	body?: object
): Promise<{ id?: string; status?: string; error?: string }> {
	const request = new Request('http://tracker.local' + path, {
		method,
		headers: { 'x-tracker-as': 'tracker backups' },
		body: body && JSON.stringify(body)
	});
	return (await items.handle(request)).json();
}
