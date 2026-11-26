// @harness-uid u_vv3mkblggu
import { setTimeout as delay } from 'node:timers/promises';
import { loadTrackerNodeConfig } from './tracker-node-service/trackerNodeConfig';
import type { TrackerNodeConfig } from './tracker-node-service/trackerNodeConfig.types';
import type { TrackerHealthOptions, TrackerHealthReport } from './TrackerHealthService.types';
import { alertTrackerHealth } from './tracker-health-service/alertTrackerHealth';
import { localTrackerHealthHost } from './tracker-health-service/localTrackerHealthHost';
import { trackerHealthApiCheck } from './tracker-health-service/trackerHealthApi';
import { trackerHealthHostChecks } from './tracker-health-service/trackerHealthHostChecks';
import { trackerHealthStatusChecks } from './tracker-health-service/trackerHealthStatusChecks';
import {
	readTrackerHealthState,
	writeTrackerHealthState
} from './tracker-health-service/trackerHealthState';

/** Checks one node from outside its service process, so a dead service is still reported. */
export class TrackerHealthService {
	private readonly config: TrackerNodeConfig;

	constructor(
		private readonly configPath: string,
		private readonly options: TrackerHealthOptions = {}
	) {
		this.config = loadTrackerNodeConfig(configPath);
	}

	/** A release restarts the service for a few seconds; that must not page anyone. */
	private async api(alert: boolean) {
		const first = await trackerHealthApiCheck(this.config);
		if (first.status || !alert) return first;
		await delay(this.options.apiRetryMs ?? 20_000);
		return trackerHealthApiCheck(this.config);
	}

	async run({ alert }: { alert: boolean }): Promise<TrackerHealthReport> {
		const now = (this.options.now ?? Date.now)();
		const host = this.options.host ?? localTrackerHealthHost();
		const stateFile = this.config.database + '.health.json';
		const state = readTrackerHealthState(stateFile);
		const api = await this.api(alert);
		const checks = [
			api.check,
			...(api.status
				? await trackerHealthStatusChecks(this.config, api.status, { now, state })
				: []),
			...trackerHealthHostChecks(host, { configPath: this.configPath, config: this.config }, api)
		];
		const report: TrackerHealthReport = {
			at: new Date(now).toISOString(),
			node: this.config.node,
			ok: checks.every((check) => check.ok || check.severity === 'info'),
			failing: checks.filter((check) => !check.ok && check.severity === 'fail'),
			checks,
			alertProblems: []
		};
		if (alert) {
			const post = this.options.post ?? fetch;
			const target = { config: this.config, configPath: this.configPath, post, now };
			await alertTrackerHealth(target, report, state);
			state.webhook_failed = api.status?.webhook?.outbox
				? (api.status.webhook.outbox.failed ?? 0)
				: state.webhook_failed;
			writeTrackerHealthState(stateFile, state);
		}
		return report;
	}
}
