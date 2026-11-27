// @harness-uid u_qqfbrdf4z2
import { z } from 'zod';
import type { ContainerBrowserPipes } from '../../core/execution-runtimes/containerBrowser.types';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import type {
	ContainerHistoryAction,
	ContainerPage,
	ContainerPageTarget
} from './ContainerCdpAdapter.types';
import { CdpSession } from './container-cdp-adapter/CdpSession';
import { pipeHttpJson } from './container-cdp-adapter/pipeHttpJson';

const targets = z.array(z.object({ id: z.string(), type: z.string(), url: z.string() }));
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

	/** Navigate the page with keyboard focus, even if it's an address-bar-less popup. */
	async navigateFocused(action: ContainerHistoryAction | 'open', address: string): Promise<void> {
		const targets = await this.pages();
		for (const target of targets) {
			const page = await this.session(target).catch(() => undefined);
			if (!page) continue;
			try {
				const focused = await page.evaluate('document.hasFocus()').catch(() => false);
				if (targets.length > 1 && focused !== true) continue;
				if (action === 'open') await page.navigate(address);
				else await page.history(action);
				return;
			} finally {
				page.close();
			}
		}
		throw new ExpectedCliError('The container browser needs a focused page.');
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
