// @harness-uid u_44o75ivrws
/** @pure Splits plain text into unchanged text and absolute HTTP(S) links. */
export function linkSegments(text: string): { text: string; href?: string }[] {
	const segments: { text: string; href?: string }[] = [];
	const candidates = /(^|[^\p{L}\p{N}_:/@=+%-])(https?:\/\/[^\s<>"'`\\]+)/giu;
	let cursor = 0;

	for (const match of text.matchAll(candidates)) {
		const value = trimProseEnding(match[2]);
		if (!validUrl(value)) continue;
		const start = match.index + match[1].length;
		if (start > cursor) segments.push({ text: text.slice(cursor, start) });
		segments.push({ text: value, href: value });
		cursor = start + value.length;
	}

	if (cursor < text.length) segments.push({ text: text.slice(cursor) });
	return segments;
}

/** @pure Recognizes text that needs a link separate from its surrounding control. */
export function hasWebLink(text: string): boolean {
	return linkSegments(text).some((segment) => segment.href !== undefined);
}

function validUrl(value: string): boolean {
	try {
		const { protocol, hostname } = new URL(value);
		return Boolean(hostname && (protocol === 'http:' || protocol === 'https:'));
	} catch {
		return false;
	}
}

function delimiterBalance(value: string) {
	const balance = { ')': 0, ']': 0, '}': 0 };
	for (const character of value) {
		if (character === '(') balance[')']++;
		if (character === '[') balance[']']++;
		if (character === '{') balance['}']++;
		if (character === ')' || character === ']' || character === '}') balance[character]--;
	}
	return balance;
}

function trimProseEnding(value: string): string {
	const balance = delimiterBalance(value);
	let end = value.length;
	while (end > 0) {
		const trailing = value[end - 1];
		if (/[.,!?;:]/.test(trailing)) end--;
		else if ((trailing === ')' || trailing === ']' || trailing === '}') && balance[trailing] < 0) {
			balance[trailing]++;
			end--;
		} else break;
	}
	return value.slice(0, end);
}
