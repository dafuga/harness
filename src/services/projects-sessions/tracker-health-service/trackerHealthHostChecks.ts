// @harness-uid u_og7grs5lnd
import { dirname } from 'node:path';
import type { TrackerNodeConfig } from '../tracker-node-service/trackerNodeConfig.types';
import type { TrackerHealthCheck, TrackerHealthHost } from '../TrackerHealthService.types';
import type { TrackerHealthApiResult } from './trackerHealthApi.types';

const minFreeDiskGb = 5;
const minAvailableMemoryMb = 1024;
const maxLoadPerCore = 2;
const strayMinutes = 60;

export function trackerHealthHostChecks(
	host: TrackerHealthHost,
	node: { configPath: string; config: TrackerNodeConfig },
	api: TrackerHealthApiResult
): TrackerHealthCheck[] {
	const { status } = api;
	const freeGb = host.freeDiskBytes(dirname(node.config.database)) / 1e9;
	const memory = host.availableMemoryMb();
	const load = host.load15();
	return [
		strayCheck(host, node.configPath, status?.pid),
		check('disk', freeGb >= minFreeDiskGb, `${freeGb.toFixed(1)} GB free for the database`),
		...(memory === null
			? []
			: [check('memory', memory >= minAvailableMemoryMb, `${Math.round(memory)} MB available`)]),
		check(
			'load',
			load < host.cores * maxLoadPerCore,
			`load(15) ${load.toFixed(2)} on ${host.cores} cores`
		)
	];
}

/** A second long-lived service on the same config. Without a live pid there is nothing to compare. */
function strayCheck(host: TrackerHealthHost, configPath: string, livePid: number | undefined) {
	const serving = host
		.processes()
		.filter(
			({ command }) => command.includes(' tracker serve ') && command.includes(` ${configPath} `)
		);
	const stray = serving.filter(
		({ pid, ageMinutes }) => livePid !== undefined && pid !== livePid && ageMinutes > strayMinutes
	);
	const listed = stray
		.map(({ pid, ageMinutes }) => `pid ${pid} (${Math.round(ageMinutes)} min)`)
		.join(', ');
	return check(
		'stray_services',
		!stray.length,
		stray.length ? `extra Tracker service running: ${listed}` : 'none'
	);
}

function check(name: string, ok: boolean, detail: string): TrackerHealthCheck {
	return { name, ok, severity: 'fail', detail };
}
