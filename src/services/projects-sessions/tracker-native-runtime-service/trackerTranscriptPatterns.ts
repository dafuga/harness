// @harness-uid u_bl6xl2h4a3
const formats = {
	'Google OAuth client secret': /\bGOCSPX-[A-Za-z0-9_-]{20,160}(?![A-Za-z0-9_-])/u,
	'Google API key': /\bAIza[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/u,
	'Stripe API key': /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,200}\b/u,
	'Stripe webhook signing secret': /\bwhsec_[A-Za-z0-9]{16,200}\b/u,
	'OpenAI API key':
		/\bsk-(?:(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,250}|[A-Za-z0-9]{20,160})(?![A-Za-z0-9_-])/u,
	'GitHub token': /\b(?:gh[pousr]_[A-Za-z0-9]{36,160}|github_pat_[A-Za-z0-9_]{60,200})\b/u,
	'npm token': /\bnpm_[A-Za-z0-9]{36,100}\b/u,
	'AWS access key ID': /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
	'Cloudflare API token':
		/\b(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*["\\]*\s*[:=]\s*["'\\]*[A-Za-z0-9_-]{40}(?![A-Za-z0-9_-])/iu,
	'Twilio credential':
		/\b(?:AC|SK)[a-f0-9]{32}\b[^\r\n]{0,400}?\b(?:TWILIO_(?:AUTH_TOKEN|API_KEY_SECRET)|auth[_ ]?token|secret)\s*["\\]*\s*[:=]\s*["'\\]*[a-f0-9]{32}\b|\bTWILIO_(?:AUTH_TOKEN|API_KEY_SECRET)\s*["\\]*\s*[:=]\s*["'\\]*[a-f0-9]{32}\b/iu,
	'Private key': /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----\s*(?:\\[rn]\s*)*[A-Za-z0-9+/]{16}/u
} as const;

/** Return the type and byte position of each format, without returning matched text. */
export function trackerTranscriptMatches(bytes: Buffer, offset: number) {
	const text = bytes.toString('latin1');
	return Object.entries(formats).flatMap(([type, pattern]) => {
		const start = pattern.exec(text)?.index;
		return start === undefined ? [] : [{ type, byte: offset + start }];
	});
}
