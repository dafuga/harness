import { existsSync } from 'node:fs';
import { once } from 'node:events';
import { chromium } from 'playwright-core';
import { expect, test } from 'vitest';
import WebSocket from 'ws';
import { VaultCdpRelayAdapter } from '../src/adapters/accounts-access/VaultCdpRelayAdapter';
import type {
	VaultAttachment,
	VaultLeaseEnded
} from '../src/services/accounts-access/VaultLeaseKeeperService.types';
import {
	approved,
	assertFixtureIsolated,
	assertFixtureRemoved,
	browserFixture,
	denied,
	withHttpsFixture
} from './support/credential-vault/dockerBrowser';

const image = process.env.HARNESS_TEST_VAULT_DOCKER_IMAGE;

// The task-owned image is opt-in on hosts with a Linux Docker engine and namespace sandboxing.
test.skipIf(!image)(
	'a lease drives headed Chromium through its Unix socket and scoped egress',
	async () => {
		await withHttpsFixture(image!, async ({ id, ip }) => {
			const run = await browserFixture(image!);
			try {
				await verifyBrowserLease(run, id, ip);
			} finally {
				await run.close();
			}
		});
	},
	60_000
);

async function verifyBrowserLease(
	run: Awaited<ReturnType<typeof browserFixture>>,
	id: string,
	ip: string
) {
	const hosts = { [new URL(approved).hostname]: ip, [new URL(denied).hostname]: ip };
	const guest = await run.docker.launch({
		origins: [approved],
		redirects: [],
		network: { id, hosts }
	});
	try {
		const { lease } = run.keeper.issue(run.ticket, run.uid, {
			logout: '/logout',
			revoke: null,
			securityLog: 'fixture-security-log'
		});
		const relay = new VaultCdpRelayAdapter({
			keeper: run.keeper,
			lease,
			peerUid: (socket) => run.peer.uid(socket),
			pipe: guest.pipe
		});
		try {
			await relay.listen();
			const scope = { lease, session: run.input.session };
			const attachment = await run.client.call<VaultAttachment>('/v1/session/attach', scope);
			await expectMissingToken(attachment.endpoint, run.uid);
			await verifyOriginPolicy(attachment, guest.owner, ip);
			const ended = await run.client.call<VaultLeaseEnded>('/v1/session/finish', scope);
			expect(ended.ended).toBe('finished');
			await relay.close();
			expect(existsSync(run.keeper.relaySocketPath(lease))).toBe(false);
		} finally {
			await relay.close();
		}
	} finally {
		await guest.close();
		await assertFixtureRemoved(guest.owner);
	}
}

async function verifyOriginPolicy(attachment: VaultAttachment, owner: string, ip: string) {
	const browser = await chromium.connectOverCDP(attachment.endpoint, {
		headers: attachment.headers,
		timeout: 10_000
	});
	try {
		const page = await browser.newPage({ ignoreHTTPSErrors: true });
		await page.goto('chrome://sandbox');
		expect(await page.locator('body').innerText()).toMatch(/Seccomp-BPF sandbox\s+Yes/u);
		await page.goto(approved, { timeout: 8_000 });
		expect(await page.title()).toBe('Vault fixture');
		expect(await page.locator('h1').innerText()).toBe('Approved synthetic origin');
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
