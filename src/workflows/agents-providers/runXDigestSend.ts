// @harness-uid u_5unsyumim2
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type {
	XDigestSenderConfig,
	XDigestSendReport
} from '../../core/agents-providers/xDigestSend.types';
import { XDigestSendStateRepository } from '../../repositories/agents-providers/XDigestSendStateRepository';
import { XDigestSendService } from '../../services/agents-providers/XDigestSendService';
import { XDigestSenderConfigValidator } from '../../validators/agents-providers/XDigestSenderConfigValidator';
import type { XDigestSendRunInput } from './runXDigestSend.types';
import { xDigestAsk } from './run-x-digest/xDigestAsk';
import { xDigestHome } from './run-x-digest/xDigestHome';
import { fetchOutbox } from './run-x-digest-send/fetchOutbox';
import { secretManagerToken } from './run-x-digest-send/secretManagerToken';
import { slackWhoAmI } from './run-x-digest-send/slackWhoAmI';
import { xDigestSlack } from './run-x-digest-send/xDigestSlack';

const everyMinutes = 5;
const done = new Set<XDigestSendReport['status']>(['sent', 'already-sent', 'blocked']);

/** Waits for the collector's file, then posts it. Prints the outcome, never message text. */
export async function runXDigestSend(input: XDigestSendRunInput): Promise<number> {
	const config = await load(input.config);
	const service = createService(config, input);
	let report = await service.run();
	for (let waited = 0; pending(report) && waited < input.wait; waited += everyMinutes) {
		await delay(everyMinutes * 60_000);
		report = await service.run();
	}
	console.log(JSON.stringify(report));
	// A blocked collector has already asked; a digest that never showed up has not.
	return done.has(report.status) ? 0 : 1;
}

export async function printSlackIdentity(secretConfig: string): Promise<number> {
	const config = await load(secretConfig);
	console.log(JSON.stringify(await slackWhoAmI(await secretManagerToken(config.slack.secret))));
	return 0;
}

async function load(path: string): Promise<XDigestSenderConfig> {
	return new XDigestSenderConfigValidator().parse(JSON.parse(await readFile(path, 'utf8')));
}

function pending(report: XDigestSendReport): boolean {
	return report.status === 'waiting' || report.status === 'blocked';
}

function createService(
	config: XDigestSenderConfig,
	input: XDigestSendRunInput
): XDigestSendService {
	const state = resolve(input.state ?? join(xDigestHome(), 'send-state.json'));
	const ask = xDigestAsk(config.tracker);
	return new XDigestSendService({
		fetch: (day) => fetchOutbox(config.source, day),
		state: new XDigestSendStateRepository(state),
		send: xDigestSlack(config.slack, join(xDigestHome(), 'audit.ndjson'), () =>
			secretManagerToken(config.slack.secret)
		),
		ask
	});
}
