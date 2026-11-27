// @harness-uid u_cjwknh5i63
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ContainerBrowserAdapter } from '../../adapters/execution-runtimes/ContainerBrowserAdapter';
import { ContainerCdpAdapter } from '../../adapters/execution-runtimes/ContainerCdpAdapter';
import { ensureColima } from '../../adapters/execution-runtimes/container-browser-adapter/colimaRuntime';
import type { XDigestConfig, XDigestReport } from '../../core/agents-providers/xDigest.types';
import { XDigestOutboxRepository } from '../../repositories/agents-providers/XDigestOutboxRepository';
import { XDigestStateRepository } from '../../repositories/agents-providers/XDigestStateRepository';
import { ViewerDeviceRepository } from '../../repositories/execution-runtimes/ViewerDeviceRepository';
import { XDigestService } from '../../services/agents-providers/XDigestService';
import { XFeedReaderService } from '../../services/agents-providers/XFeedReaderService';
import { XDigestConfigValidator } from '../../validators/agents-providers/XDigestConfigValidator';
import {
	containerBrowserSources,
	containerBrowserState
} from '../execution-runtimes/run-container-browser/containerBrowserPaths';
import type { XDigestRunInput } from './runXDigest.types';
import { xDigestAsk } from './run-x-digest/xDigestAsk';
import { xDigestHome } from './run-x-digest/xDigestHome';

const done = new Set<XDigestReport['status']>(['queued', 'dry-run', 'already-queued']);

/** Prints the outcome and counts only; feed content goes nowhere but the outbox. */
export async function runXDigest(input: XDigestRunInput): Promise<number> {
	const config = new XDigestConfigValidator().parse(
		JSON.parse(await readFile(input.config, 'utf8'))
	);
	const service = await createService(config, input);
	let report = await service.run(input);
	for (let minute = 0; report.status === 'attended' && minute < input.wait; minute++) {
		await delay(60_000);
		report = await service.run(input);
	}
	console.log(JSON.stringify(report));
	return done.has(report.status) ? 0 : 1;
}

function outboxPath(configured?: string): string {
	const path = configured ?? '~/.local/share/harness-x-digest/out';
	return resolve(path.replace(/^~(?=\/)/u, homedir()));
}

async function createService(
	config: XDigestConfig,
	input: XDigestRunInput
): Promise<XDigestService> {
	const browser = new ContainerBrowserAdapter({ profile: config.profile });
	await ensureColima();
	await browser.up(containerBrowserSources().seccomp);
	const viewers = new ViewerDeviceRepository(containerBrowserState(config.profile));
	const state = resolve(input.state ?? join(xDigestHome(), 'state.json'));
	return new XDigestService(config, {
		reader: new XFeedReaderService({ browser: new ContainerCdpAdapter(browser) }),
		state: new XDigestStateRepository(state),
		outbox: new XDigestOutboxRepository(outboxPath(config.outbox)),
		ask: xDigestAsk(config.tracker),
		attended: () => viewers.attended()
	});
}
