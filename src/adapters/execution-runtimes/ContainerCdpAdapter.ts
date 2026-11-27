// @harness-uid u_qqfbrdf4z2
import { setTimeout } from 'node:timers/promises';
import { z } from 'zod';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import type { ContainerBrowserPipes } from '../../core/execution-runtimes/containerBrowser.types';
import type { ContainerPage, ContainerPageTarget } from './ContainerCdpAdapter.types';
import { CdpSession } from './container-cdp-adapter/CdpSession';
import { pipeHttpJson } from './container-cdp-adapter/pipeHttpJson';

const targets = z.array(z.object({ id: z.string(), type: z.string(), url: z.string() }));
const closeWaitMs = 2_000;
const pageId = /^[A-Za-z0-9-]{1,128}$/u;

/** DevTools for a container browser, entirely through private `docker exec` pipes. */
export class ContainerCdpAdapter {
	constructor(private readonly pipes: ContainerBrowserPipes) {}

	/** Lists tab addresses without attaching to, or reading, any page. */
	async pages(): Promise<ContainerPageTarget[]> {
		const listed = await pipeHttpJson(this.pipes.pipe('devtools'), '/json/list');
		return targets
			.parse(listed)
			.filter((target) => target.type === 'page' && pageId.test(target.id))
			.map(({ id, url }) => ({ id, url }));
	}

	attach(target: ContainerPageTarget): Promise<ContainerPage> {
		return this.session(target);
	}

	/** Dispose of one reviewed tab and confirm its absence before the executor can resume reads. */
	async closePage(id: string): Promise<void> {
		if (!pageId.test(id)) throw new ExpectedCliError('Invalid browser tab.');
		const target = (await this.pages()).find((page) => page.id === id);
		if (!target) return;
		const session = await this.session(target).catch(() => undefined);
		try {
			await session?.closeTarget(id);
		} catch {
			// Closing the target can tear down its session before it acknowledges.
		} finally {
			session?.close();
		}
		const deadline = performance.now() + closeWaitMs;
		while ((await this.pages()).some((page) => page.id === id)) {
			if (performance.now() >= deadline)
				throw new ExpectedCliError('The private browser tab is still open.');
			await setTimeout(100);
		}
	}

	/**
	 * Asks the browser to quit, which writes its cookies at once. Stopping the container alone can
	 * lose any newer than the browser's periodic save, about 30 seconds.
	 */
	async quit(): Promise<void> {
		const [target] = await this.pages();
		if (!target) return;
		const session = await this.session(target);
		await session.closeBrowser();
		session.close();
	}

	private session(target: ContainerPageTarget): Promise<CdpSession> {
		return CdpSession.open(this.pipes.pipe('devtools'), `/devtools/page/${target.id}`);
	}
}
