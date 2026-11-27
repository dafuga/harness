// @harness-uid u_5euoqnzpyw
import { setTimeout as delay } from 'node:timers/promises';
import type { XBlock, XFeeds, XReadResult } from '../../core/agents-providers/xDigest.types';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import type { XFeedReaderPorts } from './XFeedReaderService.types';
import { classifyXUrl } from './x-feed-reader-service/classifyXUrl';
import { XTabReader } from './x-feed-reader-service/XTabReader';

const home = 'https://x.com/home';
const mentions = 'https://x.com/notifications/mentions';
const emptyTab = /^(about:blank|chrome:\/\/(newtab|new-tab-page)\/?)$/u;

/** A read-only pass over Following, For You and mentions in the signed-in container browser. */
export class XFeedReaderService {
	constructor(private readonly ports: XFeedReaderPorts) {}

	async read(scan: number): Promise<XReadResult> {
		const pages = await this.ports.browser.pages();
		// A tab already waiting on a person is left exactly as it is.
		for (const page of pages) {
			const state = classifyXUrl(page.url);
			if (state === 'signed-out' || state === 'site-check') return { status: state };
		}
		if (!pages.length) throw new ExpectedCliError('The container browser has no open tab.');
		// Only a feed tab or an empty one is taken over: any other page may be a sign-in step on
		// another site, which is the owner's to finish.
		const target =
			pages.find((page) => classifyXUrl(page.url) === 'feed') ??
			pages.find((page) => emptyTab.test(page.url));
		if (!target) return { status: 'signed-out' };
		const session = await this.ports.browser.attach(target);
		try {
			return await this.readFeeds(
				new XTabReader(
					{
						state: () => this.state(target.id),
						pause: this.ports.pause ?? ((ms) => delay(ms))
					},
					session
				),
				scan
			);
		} finally {
			session.close();
		}
	}

	private async readFeeds(tab: XTabReader, scan: number): Promise<XReadResult> {
		const feeds: XFeeds = { mentions: [], following: [], forYou: [] };
		let blocked: XBlock | undefined = await tab.open(home);
		if (blocked) return { status: blocked };
		await tab.selectTab(1);
		feeds.following = await tab.collect(scan);
		await tab.selectTab(0);
		feeds.forYou = await tab.collect(scan);
		// An empty home feed means the page was not understood, never "nothing new".
		if (!feeds.following.length || !feeds.forYou.length)
			throw new ExpectedCliError('X showed no readable posts; its page layout may have changed.');
		blocked = await tab.open(mentions);
		if (blocked) return { status: blocked };
		feeds.mentions = await tab.collect(scan);
		return { status: 'ok', feeds };
	}

	private async state(id: string) {
		const page = (await this.ports.browser.pages()).find((entry) => entry.id === id);
		return classifyXUrl(page?.url ?? '');
	}
}
