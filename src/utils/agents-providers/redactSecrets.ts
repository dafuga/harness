// @harness-uid u_kg5hqh3zab
const patterns: readonly RegExp[] = [
	/xox[abprs]-[A-Za-z0-9-]{8,}/g,
	/xapp-[A-Za-z0-9-]{8,}/g,
	/\bgh[pousr]_[A-Za-z0-9]{20,}/g,
	/github_pat_[A-Za-z0-9_]{20,}/g,
	/sk-ant-[A-Za-z0-9_-]{16,}/g,
	/\bsk_(?:live|test)_[A-Za-z0-9]{16,}/g,
	/\bwhsec_[A-Za-z0-9]{16,}/g,
	/\bAKIA[0-9A-Z]{16}\b/g,
	/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
	/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
	/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi,
	/(?:\/[\w.-]+)*\/\.secrets?\/[\w./-]*/g,
	/\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S{8,}/gi
];

/** Replace anything shaped like a credential or secret path with a fixed marker. */
export function redactSecrets(text: string): string {
	return patterns.reduce((value, pattern) => value.replace(pattern, '[redacted]'), text);
}
