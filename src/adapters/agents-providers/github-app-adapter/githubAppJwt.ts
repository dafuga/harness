// @harness-uid u_kg5hqb3ghj
import { createSign } from 'node:crypto';

/** Sign the short-lived RS256 JWT GitHub requires to act as the App. */
export function githubAppJwt(appId: string, privateKeyPem: string, nowMs: number): string {
	const seconds = Math.floor(nowMs / 1000);
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
	const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
		iat: seconds - 60,
		exp: seconds + 540,
		iss: appId
	})}`;
	const signature = createSign('RSA-SHA256').update(unsigned).sign(privateKeyPem, 'base64url');
	return `${unsigned}.${signature}`;
}
