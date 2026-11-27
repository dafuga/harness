// @harness-uid u_qqfbrdf4z2
import { z } from 'zod';
import type { ContainerBrowserPipes } from '../../core/execution-runtimes/containerBrowser.types';
import type { ContainerPage, ContainerPageTarget } from './ContainerCdpAdapter.types';
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
