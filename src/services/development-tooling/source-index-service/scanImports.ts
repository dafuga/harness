import type { LiteralPattern, Found } from './scanImports.types';
import type {
	SourceReference,
	SourceLanguage
} from '../../../utils/development-tooling/scanImports';
import { svelteScripts } from '../../../utils/development-tooling/scanImports';
import { maskSource } from '../../../utils/development-tooling/maskSource';
import { atomicSyntax } from '../../../templates/development-tooling/atomicSyntax.js';

const literalPatterns: LiteralPattern[] = [
	{ via: 'import', pattern: /\bimport\b(\s+type\b)?[^'"\x60;():=]*?(['"])([^'"\n]*)\2/g },
	{
		via: 'reexport',
		pattern: /\bexport\s+(type\s+)?(?:\*(?:\s*as\s+[\w$]+)?|\{[^}]*\})\s*from\s*(['"])([^'"\n]*)\2/g
	},
	{ via: 'url', pattern: /\bnew\s+URL\s*\(\s*()(['"])([^'"\n]*)\2\s*,\s*import\.meta\.url/g }
];

const callPatterns: LiteralPattern[] = [
	{ via: 'dynamic-import', pattern: /\bimport\s*\(/g },
	{ via: 'require', pattern: /\brequire\s*\(/g }
];

/** Lists module references in source order, ignoring comments and literal contents. */
export function scanImports(code: string, language: SourceLanguage): SourceReference[] {
	if (language === 'css') return styleReferences(code);
	if (language === 'svelte')
		return [
			...svelteScripts(code).flatMap((script) => scriptReferences(script)),
			...atomReferences(code)
		];
	return language === 'ts' ? scriptReferences(code) : [];
}

function atomReferences(code: string): SourceReference[] {
	if (!code.includes('<hx-')) return [];
	let syntax;
	try {
		syntax = atomicSyntax(code);
	} catch {
		return [];
	}
	if (!syntax.directory) return [];
	const names = new Set(syntax.atoms.flatMap((atom) => atom.definition?.name ?? []));
	return [...names].map((name) => ({
		specifier: `${syntax.directory}/${name}.svelte`,
		via: 'import',
		typeOnly: false
	}));
}

function scriptReferences(code: string): SourceReference[] {
	const masked = maskSource(code);
	const found = [
		...literalPatterns.flatMap((entry) => literalReferences(code, masked, entry)),
		...callPatterns.flatMap((entry) => callReferences(code, masked, entry))
	];
	return unique(found.sort((left, right) => left.index - right.index));
}

function literalReferences(code: string, masked: string, entry: LiteralPattern): Found[] {
	return [...masked.matchAll(entry.pattern)].flatMap((match) => {
		const end = match.index + match[0].length - (entry.via === 'url' ? urlTail(match[0]) : 1);
		const specifier = code.slice(end - match[3].length, end);
		if (entry.via === 'url' && !specifier.startsWith('.')) return [];
		return [{ index: match.index, specifier, via: entry.via, typeOnly: Boolean(match[1]) }];
	});
}

function urlTail(text: string): number {
	return text.length - text.search(/['"]\s*,\s*import\.meta\.url$/);
}

function callReferences(code: string, masked: string, entry: LiteralPattern): Found[] {
	return [...masked.matchAll(entry.pattern)].flatMap((match): Found[] => {
		const open = match.index + match[0].length;
		const close = closingParen(masked, open);
		if (isMember(masked, match.index, close)) return [];
		const argument = code.slice(open, close).trim();
		const literal = /^(['"\x60])([^'"\x60\n$]*)\1$/.exec(argument);
		const base = { index: match.index, via: entry.via, typeOnly: false };
		if (literal) return [{ ...base, specifier: literal[2] }];
		const detail = code.slice(match.index, close + 1).slice(0, 120);
		return [{ ...base, specifier: null, detail }];
	});
}

/** A property access or a method declaration named like the keyword is not a module call. */
function isMember(masked: string, start: number, close: number): boolean {
	const before = masked.slice(0, start).trimEnd().at(-1);
	const after = masked.slice(close + 1, close + 40).trimStart()[0];
	return before === '.' || after === '\x7b' || after === ':';
}

function closingParen(masked: string, open: number): number {
	let depth = 1;
	for (let index = open; index < masked.length; index += 1) {
		if (masked[index] === '(') depth += 1;
		if (masked[index] === ')') depth -= 1;
		if (depth === 0) return index;
	}
	return masked.length;
}

function styleReferences(code: string): SourceReference[] {
	const clean = code.replace(/\/\*[\s\S]*?\*\//g, (comment) => ' '.repeat(comment.length));
	return [...clean.matchAll(/@import\s+(?:url\(\s*)?(['"])([^'"\n]+)\1/g)].map((match) => ({
		specifier: match[2],
		via: 'style-import' as const,
		typeOnly: false
	}));
}

function unique(found: Found[]): SourceReference[] {
	const seen = new Set<string>();
	return found.flatMap(({ index: _index, ...reference }) => {
		const key = `${reference.via}\n${reference.specifier ?? reference.detail}`;
		if (seen.has(key)) return [];
		seen.add(key);
		return [reference];
	});
}
