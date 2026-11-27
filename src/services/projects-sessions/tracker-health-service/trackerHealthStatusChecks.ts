// @harness-uid u_hijofchjn5
import { connect } from 'node:net';
import type { TrackerNodeConfig } from '../tracker-node-service/trackerNodeConfig.types';
import type { TrackerHealthCheck, TrackerHealthStatus } from '../TrackerHealthService.types';
import { trackerHealthBackupChecks } from './trackerHealthBackupChecks';
import type { TrackerHealthState } from './trackerHealthState.types';
import { trackerHealthWebhookChecks } from './trackerHealthWebhookChecks';

const peerWindow = 24 * 3600_000;
const hubWindow = 3600_000;

export async function trackerHealthStatusChecks(
	config: TrackerNodeConfig,
	status: TrackerHealthStatus,
	{ now, state }: { now: number; state: TrackerHealthState }
): Promise<TrackerHealthCheck[]> {
	if (config.role !== 'hub') return [upstreamCheck(status, now)];
	return [
		await listenerCheck(config.syncPort, status),
		peerCheck(status, now),
		...trackerHealthWebhookChecks(status, state),
		...trackerHealthBackupChecks(status)
	];
}

async function listenerCheck(
	port: number,
	{ sync }: TrackerHealthStatus
): Promise<TrackerHealthCheck> {
	const ok = sync?.hub === 'configured' && (await portOpen(port));
	const detail = ok ? `listening on ${port}` : `sync hub is not listening on ${port}`;
	return { name: 'sync_listener', ok, severity: 'fail', detail };
}

function portOpen(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect({ host: '127.0.0.1', port, timeout: 3000 });
		const finish = (open: boolean) => {
			socket.destroy();
			resolve(open);
		};
		socket.on('connect', () => finish(true));
		socket.on('timeout', () => finish(false));
		socket.on('error', () => finish(false));
	});
}

/** Other computers sleep, so a quiet peer is information. */
function peerCheck({ sync }: TrackerHealthStatus, now: number): TrackerHealthCheck {
	const recent = Object.entries(sync?.peers_last_seen ?? {})
		.filter(([, at]) => now - Date.parse(at) < peerWindow)
		.map(([node]) => node);
	const detail = recent.length
		? `${recent.join(', ')} seen in the last 24 h`
		: 'no computer has synced in 24 h';
	return { name: 'peers', ok: recent.length > 0, severity: 'info', detail };
}

function upstreamCheck({ sync }: TrackerHealthStatus, now: number): TrackerHealthCheck {
	const last = sync?.lastPullOk;
	const ok = Boolean(sync?.connected) || (!!last && now - Date.parse(last) < hubWindow);
	const queued = `${sync?.pending_push ?? 0} change(s) waiting to be sent`;
	const detail = ok
		? `hub link ok, ${queued}`
		: `no successful hub sync in the last hour (last ${last ?? 'never'}), ${queued}`;
	return { name: 'hub_link', ok, severity: 'fail', detail };
}
