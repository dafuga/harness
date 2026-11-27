import { ContainerBrowserAdapter } from '../../src/adapters/execution-runtimes/ContainerBrowserAdapter';
import { ContainerCdpAdapter } from '../../src/adapters/execution-runtimes/ContainerCdpAdapter';
import type { ContainerPage } from '../../src/adapters/execution-runtimes/ContainerCdpAdapter.types';
import { dockerHost } from '../../src/adapters/execution-runtimes/container-browser-adapter/dockerHost';
import { parseXPosts } from '../../src/services/agents-providers/x-feed-reader-service/parseXPosts';
import {
	readPostsScript,
	selectHomeTabScript
} from '../../src/services/agents-providers/x-feed-reader-service/xPageScripts';
import { containerBrowserSources } from '../../src/workflows/execution-runtimes/run-container-browser/containerBrowserPaths';

/** A page shaped like the parts of X the reader relies on. */
const fixture = `<main><div role="tablist"><div role="tab" aria-selected="true">For you</div>
<div role="tab" aria-selected="false">Following</div></div>
<article data-testid="tweet"><div data-testid="User-Name"><span>Fixture</span></div>
<a href="/fixture/status/12345"><time datetime="2026-11-27T00:00:00Z">1h</time></a>
<div data-testid="tweetText">Hello from a fixture</div>
<div role="group" aria-label="2 replies, 3 reposts, 1,204 likes"></div></article>
<article data-testid="tweet"><div data-testid="tweetText">An ad</div></article></main>`;

const profile = 'e2e';
const browser = new ContainerBrowserAdapter({ profile });
const docker = dockerHost();
try {
	await browser.up(containerBrowserSources().seccomp);
	const cdp = new ContainerCdpAdapter(browser);
	let pages = await cdp.pages().catch(() => []);
	for (let attempt = 0; attempt < 60 && !pages.length; attempt++) {
		await Bun.sleep(500);
		pages = await cdp.pages().catch(() => []);
	}
	const page = await cdp.attach(pages[0]);
	await page.evaluate(`document.body.innerHTML = ${JSON.stringify(fixture)}`);
	const posts = parseXPosts(await page.evaluate(readPostsScript)).map(
		({ id, author, text, likes }) => ({ id, author, text, likes })
	);
	const result = {
		published: await docker.docker(['port', `harness-browser-${profile}`]),
		screen: await greeting(),
		webdriver: await page.evaluate('navigator.webdriver'),
		headless: await page.evaluate('navigator.userAgent.includes("Headless")'),
		posts,
		tab: await page.evaluate(selectHomeTabScript(1))
	};
	const policies = await readSavingPolicies(page);
	page.close();
	console.log(JSON.stringify({ ...result, policies }));
} finally {
	await browser.remove();
	await docker.docker(['volume', 'rm', `harness-browser-${profile}-profile`]).catch(() => '');
}
process.exit(0);

async function readSavingPolicies(page: ContainerPage) {
	await page.navigate('chrome://policy/');
	return page.evaluate(`(async () => {
		const find = (root, selector) => [
			...root.querySelectorAll(selector),
			...Array.from(root.querySelectorAll('*'))
				.flatMap(element => element.shadowRoot ? find(element.shadowRoot, selector) : [])
		];
		let rows = find(document, 'policy-row');
		for (let attempt = 0; attempt < 60 && !rows.length; attempt++) {
			await new Promise(resolve => setTimeout(resolve, 100));
			rows = find(document, 'policy-row');
		}
		if (!rows.length) throw new Error('Chromium did not render the policy table.');
		const names = ['PasswordManagerEnabled', 'AutofillSettings'];
		return rows.flatMap(row => {
			const content = row.shadowRoot ?? row;
			const name = row.policy?.name;
			if (!names.includes(name) || row.hidden) return [];
			const value = content.querySelector('.value')?.textContent.trim();
			return [{
				name,
				value: row.getFormattedValue?.() ?? value,
				level: content.querySelector('.level')?.textContent.trim(),
				status: content.querySelector('.messages')?.textContent.trim()
			}];
		}).sort((left, right) => left.name.localeCompare(right.name));
	})()`);
}

function greeting(): Promise<string> {
	const stream = browser.pipe('screen');
	return new Promise((resolve, reject) => {
		stream.once('data', (chunk: Buffer) => {
			stream.destroy();
			resolve(chunk.toString().trim());
		});
		stream.once('error', reject);
	});
}
