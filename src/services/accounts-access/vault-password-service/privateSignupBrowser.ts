// @harness-uid u_mucsxl7k4y
import { chromium, type ConnectOverCDPTransport } from 'playwright-core';
import type { VaultBrowserDockerAdapter } from '../../../adapters/accounts-access/VaultBrowserDockerAdapter';
import type { VaultFixtureNetwork } from '../../../adapters/accounts-access/VaultBrowserDockerAdapter.types';
import { prepareSignupForm } from './browserSignup';
import type { VaultSignup } from './browserSignup.types';
import type { VaultPasswordBrowser } from '../VaultPasswordService.types';

export async function openPrivateSignupBrowser(
	docker: VaultBrowserDockerAdapter,
	network: VaultFixtureNetwork,
	signup: VaultSignup,
	timeout: number
): Promise<VaultPasswordBrowser> {
	const guest = await docker.launch({ origins: [signup.origin], redirects: [], network });
	let release: (() => void) | undefined;
	const transport: ConnectOverCDPTransport = {
		send: (message) => {
			if (!guest.pipe.send(JSON.stringify(message))) transport.onclose?.();
		},
		close: () => {
			release?.();
			transport.onclose?.();
		}
	};
	const close = async () => {
		release?.();
		try {
			await guest.close();
		} finally {
			transport.onclose?.();
		}
	};
	try {
		release = guest.pipe.listen({
			message: (message) => transport.onmessage?.(JSON.parse(message)),
			close: () => transport.onclose?.()
		});
		const browser = await chromium.connectOverCDP(transport, { noDefaults: true, timeout: 8_000 });
		const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block' });
		const page = await context.newPage();
		page.setDefaultTimeout(timeout);
		return {
			prepareForm: () => prepareSignupForm(page, signup),
			close
		};
	} catch {
		await close();
		throw new Error('The private signup browser is unavailable.');
	}
}
