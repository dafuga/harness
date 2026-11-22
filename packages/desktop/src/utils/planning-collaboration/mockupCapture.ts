// @harness-uid u_f2wpkt3xth
import type { Browser, Page } from 'playwright-core';
import { RunCancelled } from '../../models/agents-providers/AgentRunner.types';
import type { MockupCapture } from './mockupSource.types';
import { MockupFailure } from './mockupSource';

const url = 'http://mockup.invalid/';
const contentPolicy =
	"default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; sandbox";

async function launchBrowser(): Promise<Browser> {
	const { chromium } = await import('playwright-core');
	const launch = { headless: true, chromiumSandbox: true, timeout: 15000 };
	try {
		return await chromium.launch(launch);
	} catch {
		try {
			return await chromium.launch({ ...launch, channel: 'chrome' });
		} catch {
			throw new MockupFailure(
				'Install Playwright Chromium or Google Chrome to render Plan mockups.'
			);
		}
	}
}

async function waitForContent(page: Page) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		const images = [...document.images].filter((image) => image.getClientRects().length);
		await Promise.all(images.map((image) => image.decode()));
	});
}

async function screenshot(browser: Browser, capture: MockupCapture): Promise<Buffer> {
	const page = await browser.newPage({
		viewport: capture.viewport,
		colorScheme: capture.scheme,
		javaScriptEnabled: false,
		serviceWorkers: 'block',
		reducedMotion: 'reduce'
	});
	try {
		await page.route('**/*', (route) => {
			if (route.request().url() !== url || route.request().resourceType() !== 'document')
				return route.abort();
			return route.fulfill({
				body: capture.html,
				contentType: 'text/html; charset=utf-8',
				headers: { 'content-security-policy': contentPolicy }
			});
		});
		await page.goto(url, { timeout: 15000 });
		await waitForContent(page);
		return await page.screenshot({ animations: 'disabled', timeout: 15000, type: 'png' });
	} finally {
		await page.close();
	}
}

export async function mockupCapture(
	captures: MockupCapture[],
	signal: AbortSignal
): Promise<Uint8Array[]> {
	if (signal.aborted) throw new RunCancelled();
	const browser = await launchBrowser();
	const cancel = () => {
		void browser.close().catch(() => {});
	};
	signal.addEventListener('abort', cancel, { once: true });
	try {
		const output: Uint8Array[] = [];
		for (const capture of captures) {
			if (signal.aborted) throw new RunCancelled();
			output.push(await screenshot(browser, capture));
		}
		return output;
	} catch (error) {
		if (signal.aborted) throw new RunCancelled();
		throw error;
	} finally {
		signal.removeEventListener('abort', cancel);
		await browser.close();
	}
}
