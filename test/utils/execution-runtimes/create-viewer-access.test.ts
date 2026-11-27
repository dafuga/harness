import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { expect, test, vi } from 'vitest';
import {
	createViewerAccess,
	viewerSessionMs
} from '../../../src/utils/execution-runtimes/createViewerAccess';

test('accepts only a signed, recent application assertion for the configured audience and owner', async () => {
	const { privateKey, publicKey } = await generateKeyPair('RS256');
	const key = { ...(await exportJWK(publicKey)), kid: 'fixture-key' };
	const fetch = vi
		.spyOn(globalThis, 'fetch')
		.mockImplementation(async () => Response.json({ keys: [key] }));
	try {
		const team = 'fixture';
		const email = 'owner@example.test';
		const audience = 'viewer-audience';
		const issuer = `https://${team}.cloudflareaccess.com`;
		const verify = createViewerAccess(team, audience, email);
		const issued = Math.floor(Date.now() / 1000);
		const expire = issued + 60;
		const token = (overrides = {}) =>
			new SignJWT({
				email,
				type: 'app',
				iss: issuer,
				aud: audience,
				iat: issued,
				exp: expire,
				...overrides
			})
				.setProtectedHeader({ alg: 'RS256', kid: key.kid })
				.setSubject('fixture-subject')
				.sign(privateKey);
		expect(await verify(await token())).toBe(expire * 1000);
		expect(fetch).toHaveBeenCalledWith(
			`${issuer}/cdn-cgi/access/certs`,
			expect.objectContaining({ method: 'GET' })
		);
		const longToken = await token({ exp: issued + 3600 });
		expect(await verify(longToken)).toBe(issued * 1000 + viewerSessionMs);
		for (const override of [
			{ email: 'someone-else@example.test' },
			{ aud: 'a-different-viewer' },
			{ iss: 'https://another-team.cloudflareaccess.com' },
			{ type: 'org' },
			{ email: undefined },
			{ exp: issued - 1 },
			{ iat: issued - 3600 }
		])
			expect(await verify(await token(override))).toBeUndefined();
		expect(await verify(email)).toBeUndefined();
		const [header, body, signature] = longToken.split('.');
		const changedSignature = (signature.startsWith('A') ? 'B' : 'A') + signature.slice(1);
		expect(await verify(`${header}.${body}.${changedSignature}`)).toBeUndefined();
	} finally {
		fetch.mockRestore();
	}
});
