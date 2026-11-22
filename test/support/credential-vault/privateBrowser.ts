import { randomUUID } from 'node:crypto';
import { clearTimeout, setTimeout } from 'node:timers';
import { chromium, type Browser, type ConnectOverCDPTransport } from 'playwright-core';
import { expect } from 'vitest';
import type { VaultCdpPipe } from '../../../src/adapters/accounts-access/vault-cdp-relay-adapter/VaultCdpPipe';
import { VaultBrowserRecipeService } from '../../../src/services/accounts-access/VaultBrowserRecipeService';
import type { VaultOtpPlan } from '../../../src/utils/accounts-access/vaultOtpRoute.types';
import type { browserFixture } from './dockerBrowser';
import { canary } from './phone';

export async function withPrivateBrowser<T>(
	pipe: VaultCdpPipe,
	use: (browser: Browser) => Promise<T>
): Promise<T> {
	let release: (() => void) | undefined;
	let cleared: (() => void) | undefined;
	const transport: ConnectOverCDPTransport = {
		send: (message) => {
			if (!pipe.send(JSON.stringify(message))) transport.onclose?.();
		},
		close: () => {
			release?.();
			transport.onclose?.();
		}
	};
	release = pipe.listen({
		message: (text) => {
			const message = JSON.parse(text);
			if (message.id === -1) cleared?.();
			else transport.onmessage?.(message);
		},
		close: () => transport.onclose?.()
	});
	const browser = await chromium.connectOverCDP(transport, { noDefaults: true, timeout: 8_000 });
	try {
		const supervisor = await browser.newBrowserCDPSession();
		await supervisor.send('Security.setIgnoreCertificateErrors', { ignore: true });
		return await use(browser);
	} finally {
		try {
			await resetRootAutoAttach(pipe, (done) => {
				cleared = done;
			});
		} finally {
			await browser.close();
		}
	}
}

async function resetRootAutoAttach(
	pipe: VaultCdpPipe,
	onReply: (done: () => void) => void
): Promise<void> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		await new Promise<void>((resolve, reject) => {
			onReply(resolve);
			timer = setTimeout(() => reject(new Error('Private CDP cleanup timed out.')), 4_000);
			const command = {
				id: -1,
				method: 'Target.setAutoAttach',
				params: { autoAttach: false, waitForDebuggerOnStart: false, flatten: true }
			};
			if (!pipe.send(JSON.stringify(command)))
				reject(new Error('Private CDP cleanup could not send.'));
		});
	} finally {
		clearTimeout(timer);
	}
}

export async function loginSyntheticFixture(
	run: Awaited<ReturnType<typeof browserFixture>>,
	pipe: VaultCdpPipe,
	channel: 'sms' | 'email'
) {
	await withPrivateBrowser(pipe, async (browser) => {
		const [context] = browser.contexts();
		context.setDefaultTimeout(8_000);
		const startingPages = context.pages();
		const openOtp = async (plan: Extract<VaultOtpPlan, { route: 'phone-entry' }>) => {
			expect(plan).toMatchObject({ source: channel, sealed: true, autofill: channel === 'sms' });
			const challenge = randomUUID();
			const recipient = run.seal.runnerKey();
			const input = Buffer.from(JSON.stringify({ otp: canary.otp }));
			try {
				const sealed = run.phone.seal.seal(recipient.publicKey, challenge, input);
				return recipient.open(challenge, sealed);
			} finally {
				input.fill(0);
			}
		};
		const executor = new VaultBrowserRecipeService({
			newPage: () => context.newPage(),
			openSecret: run.openSecret,
			openOtp
		});
		await executor.run({ recipe: run.recipe, approval: run.approved, script: run.script });
		for (const page of startingPages) await page.close();
	});
}
