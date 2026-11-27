// @harness-uid u_7fbfjj5ip5
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { GitHubIssueLabelAdapter } from '../../adapters/agents-providers/GitHubIssueLabelAdapter';
import { SlackHistoryAdapter } from '../../adapters/agents-providers/SlackHistoryAdapter';
import { TrackerNoteAdapter } from '../../adapters/agents-providers/TrackerNoteAdapter';
import type { QaSyncConfig, QaSyncReport } from '../../core/agents-providers/qaSync.types';
import { QaSyncStateRepository } from '../../repositories/agents-providers/QaSyncStateRepository';
import { QaSyncService } from '../../services/agents-providers/QaSyncService';
import { QaSyncConfigValidator } from '../../validators/agents-providers/QaSyncConfigValidator';
import { qaSyncSecret } from './run-qa-sync/qaSyncSecret';
import { renderQaSyncReport } from './run-qa-sync/renderQaSyncReport';
import type { QaSyncRunInput } from './runQaSync.types';

/** Runs one pass, or keeps polling. Returns the process exit code. */
export async function runQaSync(input: QaSyncRunInput): Promise<number> {
	const config = new QaSyncConfigValidator().parse(
		JSON.parse(await readFile(input.config, 'utf8'))
	);
	const state = new QaSyncStateRepository(
		resolve(input.state ?? join(homedir(), '.harness', 'qa-sync', `${config.project}.json`))
	);
	const service = createService(config, input, state);
	const pass = () => state.exclusive(() => service.sync(input));
	if (!input.watch) return print(await pass(), input);
	return watch(pass, input);
}

function createService(
	config: QaSyncConfig,
	input: QaSyncRunInput,
	state: QaSyncStateRepository
): QaSyncService {
	const exec = promisify(execFile);
	return new QaSyncService(config, {
		state,
		slack: new SlackHistoryAdapter({
			workspaceId: config.slack.workspaceId,
			token: qaSyncSecret('slack', input.slackTokenFile)
		}),
		github: new GitHubIssueLabelAdapter({
			...config.github,
			token: qaSyncSecret('github', input.githubTokenFile)
		}),
		tracker: new TrackerNoteAdapter({
			agent: config.tracker.agent,
			run: async (args) =>
				(await exec(input.tracker, [...args], { maxBuffer: 32 * 1024 * 1024, timeout: 60_000 }))
					.stdout
		})
	});
}

/** A failed pass is reported and the next one retries from the saved cursors. */
async function watch(pass: () => Promise<QaSyncReport>, input: QaSyncRunInput): Promise<number> {
	while (!input.signal?.aborted) {
		try {
			print(await pass(), input);
		} catch (error) {
			console.error(`QA sync failed: ${(error as Error).message}`);
		}
		await delay(input.interval * 1000, undefined, { signal: input.signal }).catch(() => {});
	}
	return 0;
}

function print(report: QaSyncReport, input: QaSyncRunInput): number {
	console.log(input.json ? JSON.stringify(report) : renderQaSyncReport(report));
	return report.errors.length ? 1 : 0;
}
