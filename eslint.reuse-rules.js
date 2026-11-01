import { parse } from 'svelte/compiler';
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
	['card', /(?:^|[\s"'`])ex-card(?:[\s"'`]|$)/],
	['pill', /(?:^|[\s"'`])(?:(?:ex-)?pill|chip)(?:[\s"'`]|$)/],
	['empty', /(?:^|[\s"'`])(?:ex-empty|empty-state|empty|empty-note|source-empty)(?:[\s"'`]|$)/],
	[
		'notice',
		/(?:^|[\s"'`])(?:ex-notice|notice|pf-notice|hc-notice|ex-gap|runtime-gap|state-gap|source-note)(?:[\s"'`]|$)/
	]
];

/** Shared primitives own their markup; feature source composes them. */
export function reuseFindings(filename, source) {
	const file = filename.replaceAll('\\', '/');
	if (shared.test(file) || /\/(?:test|tests)\//.test(file)) return [];
	const found = [];
	if (file.endsWith('.svelte')) found.push(...nativeFindings(source));
	for (const match of source.matchAll(
		/\b[\w?.]*(?:commit|hash|tip|origin|parent|sha|acknowledged)\b\??\.slice\(\s*0\s*,\s*\d+\s*\)/gi
	))
		if (!/sha256\s*\$\{\s*$/.test(source.slice(Math.max(0, match.index - 24), match.index)))
			found.push({ kind: 'commit', index: match.index });
	return found.sort((left, right) => left.index - right.index);
}

/** Read native attributes, including conditional classes and class directives. */
function nativeFindings(source) {
	const found = [];
	let tree;
	try {
		tree = parse(source, { modern: true });
	} catch {
		return found;
	}
	const walk = (node) => {
		if (!node || typeof node !== 'object') return;
		if (Array.isArray(node)) {
			node.forEach(walk);
			return;
		}
		if (node.type === 'RegularElement') inspectNative(node, source, found);
		for (const [key, value] of Object.entries(node))
			if (!['parent', 'metadata', 'loc'].includes(key)) walk(value);
	};
	walk(tree.fragment);
	return found;
}
function inspectNative(node, source, found) {
	if (['hx-table', 'hx-dl', 'table', 'dl'].includes(node.name))
		found.push({ kind: node.name.endsWith('table') ? 'table' : 'details', index: node.start });
	for (const attribute of node.attributes) {
		const directive = attribute.type === 'ClassDirective';
		if (!directive && !(attribute.type === 'Attribute' && attribute.name === 'class')) continue;
		const value = directive ? attribute.name : source.slice(attribute.start, attribute.end);
		for (const [kind, pattern] of classes)
			if (pattern.test(value)) found.push({ kind, index: attribute.start });
	}
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
