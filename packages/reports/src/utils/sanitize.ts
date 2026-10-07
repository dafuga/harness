export function sanitize(value: string): string {
	return value
		.replace(/(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '[REDACTED]')
		.replace(
			/\b((?:[\w-]*(?:api[_-]?key|token|password|secret)[\w-]*|authorization|cookie|set-cookie))\s*[:=]\s*["']?[^\s"'\n,;]+/gi,
			'$1=[REDACTED]'
		)
		.replace(
			/\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{25,}|PVT_K1_[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g,
			'[REDACTED]'
		)
		.replace(/https?:\/\/[^\s<>"']+/gi, cleanUrl);
}
function cleanUrl(value: string) {
	try {
		const url = new URL(value);
		url.username = '';
		url.password = '';
		url.search = '';
		url.hash = '';
		if (url.hostname === 'checkout.stripe.com') url.pathname = '/';
		return url.toString();
	} catch {
		return '[invalid URL]';
	}
}
export function cleanData<T>(input: T): T {
	if (typeof input === 'string') return sanitize(input) as T;
	if (Array.isArray(input)) return input.map(cleanData) as T;
	if (input && typeof input === 'object') {
		return Object.fromEntries(
			Object.entries(input).map(([key, value]) => {
				const sensitive = /^(?:.*(?:secret|password|token|apiKey)|authorization|cookie)$/i.test(
					key
				);
				return [key, sensitive ? '[REDACTED]' : cleanData(value)];
			})
		) as T;
	}
	return input;
}
