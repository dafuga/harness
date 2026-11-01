import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const allowlist = JSON.parse(
	readFileSync(new URL('./eslint.reuse-allowlist.json', import.meta.url))
);
const shared =
	/\/src\/(?:helpers\/|components\/(?:shared-primitives\/|explorer-ui\/explorer-kit\/))/;
const classes = [
	['card', /\bex-card\b/],
	['pill', /(?:^|[\s"'`])(?:ex-)?pill(?:[\s"'`]|$)/],
	['empty', /(?:^|[\s"'`])(?:ex-empty|empty-state|empty|empty-note)(?:[\s"'`]|$)/],
	['notice', /(?:^|[\s"'`])(?:ex-notice|notice)(?:[\s"'`]|$)/]
];

/** Shared primitives own their markup; feature source composes them. */
export function reuseFindings(filename, source) {
	const file = filename.replaceAll('\\', '/');
	if (shared.test(file) || /\/(?:test|tests)\//.test(file)) return [];
	const found = [];
	if (file.endsWith('.svelte')) {
		for (const match of source.matchAll(/\bclass\s*=\s*(?:"[^"]*"|'[^']*'|\{`[^`]*`\})/g))
			for (const [kind, pattern] of classes)
				if (pattern.test(match[0].replace(/^class\s*=\s*/, '')))
					found.push({ kind, index: match.index });
		for (const match of source.matchAll(/<hx-(table|dl)(?=[\s>])/g))
			found.push({ kind: match[1] === 'table' ? 'table' : 'details', index: match.index });
	}
	for (const match of source.matchAll(
		/\b[\w?.]*(?:commit|hash|tip|origin|parent|sha|acknowledged)\b\??\.slice\(\s*0\s*,\s*\d+\s*\)/gi
	))
		found.push({ kind: 'commit', index: match.index });
	return found.sort((left, right) => left.index - right.index);
}

/** Every admitted exception belongs to the frozen ceiling and may only decrease. */
export function reuseAllowlistGaps(current, ceiling) {
	return Object.entries(current).flatMap(([key, count]) =>
		!Number.isInteger(count) || count < 1 || count > (ceiling[key] ?? 0) ? [key] : []
	);
}

export const sharedReuseRule = {
	meta: {
		type: 'problem',
		messages: {
			inline:
				'Reuse the shared {{kind}} primitive instead of hand-written markup or commit shortening.'
		}
	},
	create(context) {
		return {
			Program() {
				const source = context.sourceCode;
				const file = relative(root, context.filename).replaceAll('\\', '/');
				const used = new Map();
				for (const finding of reuseFindings(context.filename, source.text)) {
					const key = file + '#' + finding.kind;
					const count = (used.get(key) ?? 0) + 1;
					used.set(key, count);
					if (count > (allowlist[key] ?? 0))
						context.report({
							loc: source.getLocFromIndex(finding.index),
							messageId: 'inline',
							data: finding
						});
				}
			}
		};
	}
};
