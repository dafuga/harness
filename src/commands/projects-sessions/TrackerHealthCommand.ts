// @harness-uid u_ugczr4eq3b
import { parseArgs } from 'node:util';
import {
	isTrackerWorkerClient,
	trackerWorkerClientRefusal
} from '../../adapters/projects-sessions/tracker-tmux-adapter/trackerWorkerClient';
import { TrackerHealthService } from '../../services/projects-sessions/TrackerHealthService';
import { loadTrackerNodeConfig } from '../../services/projects-sessions/tracker-node-service/trackerNodeConfig';
import type { TrackerHealthReport } from '../../services/projects-sessions/TrackerHealthService.types';
import { rotateTrackerLog } from '../../services/projects-sessions/tracker-health-service/rotateTrackerLog';
import { selectedTrackerConfig } from './tracker-command/runNativeTracker';

const usage =
	'Usage: harness tracker health [--alert] [--json] [--config <path>] [--log <service log>]...';

export class TrackerHealthCommand {
	async run(args: string[]): Promise<number> {
		const input = parseHealthArgs(args);
		const config = input?.config ?? selectedTrackerConfig();
		if (input?.help) {
			console.log(usage);
			return 0;
		}
		if (!input || !config) {
			console.error(usage);
			return 2;
		}
		rotateLogs(input.log ?? []);
		try {
			return await checkNode(config, input);
		} catch {
			console.error('tracker: health could not run. Check the native configuration and its files.');
			return 2;
		}
	}
}

async function checkNode(config: string, input: { alert?: boolean; json?: boolean }) {
	if (isTrackerWorkerClient(loadTrackerNodeConfig(config))) {
		console.error(trackerWorkerClientRefusal);
		return 2;
	}
	const report = await new TrackerHealthService(config).run({ alert: Boolean(input.alert) });
	printReport(report, Boolean(input.json));
	return report.ok ? 0 : 1;
}

function parseHealthArgs(args: string[]) {
	try {
		return parseArgs({
			args,
			options: {
				alert: { type: 'boolean' },
				json: { type: 'boolean' },
				config: { type: 'string' },
				log: { type: 'string', multiple: true },
				help: { type: 'boolean', short: 'h' }
			}
		}).values;
	} catch {
		return null;
	}
}

/** A log that cannot be rotated must not stop the health check. */
function rotateLogs(logs: string[]): void {
	for (const log of logs) {
		try {
			rotateTrackerLog(log);
		} catch {
			console.error('tracker: could not rotate a service log');
		}
	}
}

function printReport(report: TrackerHealthReport, json: boolean): void {
	if (json) {
		console.log(JSON.stringify(report, null, 2));
		return;
	}
	const summary = report.ok ? 'OK' : `${report.failing.length} FAILING`;
	console.log(`tracker health ${report.at} on ${report.node}: ${summary}`);
	for (const { ok, severity, name, detail } of report.checks) {
		console.log(`  ${checkMark(ok, severity)} ${name}: ${detail}`);
	}
	for (const problem of report.alertProblems) console.error(`tracker-health: ${problem}`);
}

function checkMark(ok: boolean, severity: 'fail' | 'info'): string {
	if (ok) return 'ok  ';
	return severity === 'info' ? 'info' : 'FAIL';
}
