import { existsSync } from 'node:fs';
import { once } from 'node:events';
import { chromium } from 'playwright-core';
import { expect, test } from 'vitest';
import WebSocket from 'ws';
import { VaultCdpRelayAdapter } from '../src/adapters/accounts-access/VaultCdpRelayAdapter';
import type { VaultBrowserDockerSession } from '../src/adapters/accounts-access/VaultBrowserDockerAdapter.types';
import type {
	VaultAttachment,
	VaultLeaseEnded
} from '../src/services/accounts-access/VaultLeaseKeeperService.types';
import { canary } from './support/credential-vault/phone';
import {
	approved,
	assertFixtureIsolated,
	assertFixtureRemoved,
	browserFixture,
	denied,
	withHttpsFixture
} from './support/credential-vault/dockerBrowser';
import { verifyCrashRecovery } from './support/credential-vault/crashFixture';
import { crossUserRequester, verifyCrossUserCdp } from './support/credential-vault/crossUserCdp';
import { loginSyntheticFixture } from './support/credential-vault/privateBrowser';
import { finishSyntheticFixture } from './support/credential-vault/teardownFixture';
import { verifyPasswordSignup } from './support/credential-vault/passwordSignup';

const image = process.env.HARNESS_TEST_VAULT_DOCKER_IMAGE;
const requester = crossUserRequester();

test.skipIf(!image || process.platform !== 'darwin')(
	'a signed CLI request stores and fills one password before the private browser is destroyed',
	() => verifyPasswordSignup(image!),
	90_000
);

// A task-owned image and Docker engine are needed to exercise the Chromium namespace sandbox.
test.skipIf(!image).each(['sms', 'email'] as const)(
	'a reviewed %s OTP login stays private before scoped CDP handoff and logout',
	async (channel) => {
		await withHttpsFixture(image!, channel, async ({ id, ip, securityLog }) => {
			const run = await browserFixture(image!, false, requester);
			try {
				const hosts = { [new URL(approved).hostname]: ip, [new URL(denied).hostname]: ip };
				const guest = await run.docker.launch({
					origins: [approved],
					redirects: [],
					network: { id, hosts }
				});
				try {
					await loginSyntheticFixture(run, guest.pipe, channel);
					await verifyBrowserLease(run, guest, ip, securityLog);
				} finally {
					await guest.close();
					await assertFixtureRemoved(guest.owner);
				}
			} finally {
				await run.close();
			}
		});
	},
	60_000
);

test.skipIf(!image)(
	'a new launch recovers only the interrupted browser receipt and guest',
	() => verifyCrashRecovery(image!),
	45_000
);

async function verifyBrowserLease(
	run: Awaited<ReturnType<typeof browserFixture>>,
	guest: VaultBrowserDockerSession,
	ip: string,
	securityLog: () => Promise<string>
) {
	const { lease } = run.keeper.issue(run.ticket, run.requestUid, run.recipe.recipe.teardown);
	const relay = new VaultCdpRelayAdapter({
		keeper: run.keeper,
		lease,
		peerUid: (socket) => run.peer.uid(socket),
		pipe: guest.pipe
	});
	const scope = { lease, session: run.input.session };
	const crossUser = run.requestUid !== run.uid;
	try {
		await relay.listen();
		const attachment = crossUser
			? run.keeper.attach(lease, scope.session, run.requestUid)
			: await run.client.call<VaultAttachment>('/v1/session/attach', scope);
		await expectMissingToken(attachment.endpoint, run.uid);
		if (crossUser) {
			await verifyCrossUserCdp(attachment);
			await assertFixtureIsolated(guest.owner, ip);
		} else {
			await verifyOriginPolicy(attachment, guest.owner, ip);
		}
	} finally {
		const ended = crossUser
			? run.keeper.finish(lease, scope.session, run.requestUid)
			: await run.client.call<VaultLeaseEnded>('/v1/session/finish', scope);
		expect(ended.ended).toBe('finished');
		await finishSyntheticFixture(
			ended,
			guest,
			async () => {
				await relay.close();
				expect(existsSync(run.keeper.relaySocketPath(lease))).toBe(false);
			},
			securityLog
		);
	}
}

async function verifyOriginPolicy(attachment: VaultAttachment, owner: string, ip: string) {
	const browser = await chromium.connectOverCDP(attachment.endpoint, {
		headers: attachment.headers,
		timeout: 10_000
	});
	try {
		const [context] = browser.contexts();
		const [page] = context.pages();
		expect(context.pages().map((tab) => tab.url())).toEqual([approved + '/roster']);
		expect(await page.locator('h1').innerText()).toBe('Approved synthetic origin');
		const observed = JSON.stringify([await page.content(), await context.cookies(), page.url()]);
		expect(observed).not.toContain(canary.password);
		expect(observed).not.toContain(canary.otp);
		const cdp = await context.newCDPSession(page);
		const history = await cdp.send('Page.getNavigationHistory');
		expect(history.entries.map(({ url }) => url)).toEqual(['about:blank', approved + '/roster']);
		await page.goto('chrome://sandbox');
		expect(await page.locator('body').innerText()).toMatch(/Seccomp-BPF sandbox\s+Yes/u);
		await expect(page.goto(denied, { timeout: 5_000 })).rejects.toThrow(
			'ERR_TUNNEL_CONNECTION_FAILED'
		);
		await assertFixtureIsolated(owner, ip);
	} finally {
		await browser.close();
	}
}

async function expectMissingToken(endpoint: string, uid: number): Promise<void> {
	const copied = new WebSocket(endpoint, { headers: { 'X-Session-Uid': String(uid) } });
	const [, refused] = await once(copied, 'unexpected-response');
	refused.resume();
	expect(refused.statusCode).toBe(403);
}

test.skipIf(!image)(
	'writes a synthetic DOM secret to the private sink before browser teardown',
	() => withHttpsFixture(image!, 'sms', proveSecretCapture, true),
	60_000
);

async function proveSecretCapture({
	id,
	ip,
	securityLog
}: {
	id: string;
	ip: string;
	securityLog(): Promise<string>;
}) {
	const run = await browserFixture(image!, true);
	try {
		const guest = await run.docker.launch({
			origins: [approved],
			redirects: [],
			network: { id, hosts: { [new URL(approved).hostname]: ip } }
		});
		const written: boolean[] = [];
		try {
			await loginSyntheticFixture(run, guest.pipe, 'sms', async (bytes) => {
				written.push(Buffer.from(bytes).equals(Buffer.from('synthetic-capture-canary')));
			});
			expect(written).toEqual([true]);
			const log = JSON.parse(await securityLog());
			expect(log.active).toBe(0);
			expect(log.events.map(({ kind }: { kind: string }) => kind)).toEqual([
				'login',
				'write',
				'other'
			]);
		} finally {
			await guest.close();
			await assertFixtureRemoved(guest.owner);
		}
	} finally {
		await run.close();
	}
}
