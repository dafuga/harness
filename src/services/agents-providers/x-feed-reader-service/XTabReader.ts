// @harness-uid u_lfsepf33oh
import type { ContainerPage } from '../../../adapters/execution-runtimes/ContainerCdpAdapter.types';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { XBlock, XPost } from '../../../core/agents-providers/xDigest.types';
import { parseXPosts } from './parseXPosts';
import {
	readPostsScript,
	scrollScript,
	selectHomeTabScript,
	siteCheckScript
} from './xPageScripts';
import type { XTab } from './XTabReader.types';

const settleMs = 2500;
const loadAttempts = 12;
const maxScrolls = 15;

/** Reads feeds in one attached tab, checking the address again before every look at the page. */
export class XTabReader {
	constructor(
		private readonly tab: XTab,
		private readonly page: ContainerPage
	) {}

	/** Opens a feed address and reports what stops it from being read. */
	async open(url: string): Promise<XBlock | undefined> {
		await this.page.navigate(url);
		for (let attempt = 0; attempt < loadAttempts; attempt++) {
			await this.tab.pause(settleMs);
			const blocked = await this.blocked();
			if (blocked) return blocked;
			if (await this.tab.state().then((state) => state === 'feed')) {
				if (parseXPosts(await this.page.evaluate(readPostsScript)).length) return undefined;
			}
		}
		const state = await this.tab.state();
		return state === 'feed' ? undefined : 'signed-out';
	}

	async selectTab(index: 0 | 1): Promise<void> {
		const outcome = await this.page.evaluate(selectHomeTabScript(index));
		if (outcome === 'missing')
			throw new ExpectedCliError('X did not show its For you and Following tabs.');
		if (outcome === 'clicked') await this.tab.pause(settleMs * 2);
	}

	/** Scrolls until enough posts were seen or the feed stops growing. */
	async collect(limit: number): Promise<XPost[]> {
		const posts = new Map<string, XPost>();
		let quiet = 0;
		for (let scroll = 0; scroll < maxScrolls && posts.size < limit && quiet < 3; scroll++) {
			const before = posts.size;
			for (const post of parseXPosts(await this.page.evaluate(readPostsScript)))
				posts.set(post.id, post);
			quiet = posts.size === before ? quiet + 1 : 0;
			await this.page.evaluate(scrollScript);
			await this.tab.pause(settleMs);
		}
		return [...posts.values()].slice(0, limit);
	}

	/** Nothing is evaluated on a page whose address is a sign-in or verification step. */
	private async blocked(): Promise<XBlock | undefined> {
		const state = await this.tab.state();
		if (state === 'signed-out' || state === 'site-check') return state;
		if (state === 'feed' && (await this.page.evaluate(siteCheckScript))) return 'site-check';
		return undefined;
	}
}
