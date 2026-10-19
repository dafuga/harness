import type { ExportedSymbol } from '../core/sourceTypes';
import type { ContractItem } from '../core/unitTypes';
import { blockSpans, type BlockSpan } from './block-spans/blockSpans';
import { maskSource } from './maskSource';
import { normalizeType, parseParameters } from './parseParameters';
import { bodyEnd, matchingBrace, sourceNesting, type SourceNesting } from './sourceNesting';

export interface ExportScan {
	symbols: ExportedSymbol[];
	errors: string[];
}

interface Source {
	code: string;
	masked: string;
	nesting: SourceNesting;
}

interface Located extends ExportedSymbol {
	index: number;
}

const callable = /^[ \t]*export\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*([\w$]+)/gm;
const variable = /^[ \t]*export\s+(?:const|let|var)\s+([\w$]+)\b/gm;
const classStart = /^[ \t]*export\s+(?:default\s+)?(?:abstract\s+)?class\s+([\w$]+)/gm;
const typeStart = /^[ \t]*export\s+(?:declare\s+)?(?:interface|type|enum)\s+([\w$]+)/gm;
const listStart = /^[ \t]*export\s+(type\s+)?\{([^}]*)\}(\s*from\b)?/gm;
const defaultStart =
	/^[ \t]*export\s+default\b(?!\s+(?:async\s+)?function\s*\*?\s*[\w$]|\s+(?:abstract\s+)?class\s+[\w$])/gm;
const hidden = /^(?:(?:static|override|async|readonly)\s+)*(?:private|protected|#)/;

/** Lists exported symbols with the inputs and outputs readable from their signatures. */
export function scanExports(code: string): ExportScan {
	const masked = maskSource(code);
	const source: Source = { code, masked, nesting: sourceNesting(masked) };
	const spans = blockSpans(masked);
	const located = [
		...matches(source, callable).map((match) => callableSymbol(source, match)),
		...matches(source, variable).map((match) => variableSymbol(source, match)),
		...matches(source, classStart).flatMap((match) => classSymbols(source, match, spans)),
		...matches(source, typeStart).map((match) => plain(match, match[1], 'type')),
		...matches(source, defaultStart).map((match) => plain(match, 'default', 'default')),
		...matches(source, listStart).flatMap(listSymbols)
	];
	const symbols = located
		.sort((left, right) => left.index - right.index)
		.map(({ index: _index, ...symbol }) => symbol);
	return { symbols, errors: thrownErrors(masked) };
}

function matches(source: Source, pattern: RegExp): RegExpExecArray[] {
	return [...source.masked.matchAll(pattern)].filter(
		(match) => source.nesting.brace[match.index] === 0 && source.nesting.group[match.index] === 0
	);
}

function plain(match: RegExpExecArray, name: string, kind: ExportedSymbol['kind']): Located {
	return { index: match.index, name, kind, inputs: [] };
}

function callableSymbol(source: Source, match: RegExpExecArray): Located {
	const signature = signatureAt(source, match.index + match[0].length, match[1]);
	return { index: match.index, name: match[1], kind: 'function', ...signature };
}

function variableSymbol(source: Source, match: RegExpExecArray): Located {
	const after = match.index + match[0].length;
	const rest = source.masked.slice(after, after + 400);
	const assignment = rest.search(/=(?!>)/);
	const initializer = assignment === -1 ? '' : rest.slice(assignment + 1);
	const arrow = /^\s*(?:async\s*)?(?:<[^>(]*>\s*)?\(/.exec(initializer);
	if (arrow) {
		const open = after + assignment + arrow[0].length;
		const close = closingGroup(source.nesting, open);
		if (/^\s*(?::[\s\S]*?)?=>/.test(source.masked.slice(close + 1))) {
			const signature = signatureAt(source, open, match[1]);
			return { index: match.index, name: match[1], kind: 'function', ...signature };
		}
	}
	const single = /^\s*(?:async\s+)?([\w$]+)\s*=>/.exec(initializer);
	if (single) {
		return {
			...plain(match, match[1], 'function'),
			inputs: [{ name: `${match[1]}.${single[1]}`, type: 'unknown' }],
			output: 'unknown'
		};
	}
	const typed = /^\s*:\s*([^=]+?)\s*=(?!>)/.exec(rest);
	const output = typed ? normalizeType(source.code.slice(after, after + typed[0].length - 1)) : '';
	return { ...plain(match, match[1], 'const'), output: output.replace(/^:\s*/, '') || 'unknown' };
}

function classSymbols(source: Source, match: RegExpExecArray, spans: BlockSpan[]): Located[] {
	const prefix = `${match[1]}.`;
	const methods = spans
		.filter((span) => span.name.startsWith(prefix) && span.start > match.index)
		.filter((span) => !hidden.test(source.masked.slice(span.start, span.start + 60)))
		.map((span) => methodSymbol(source, span));
	return [plain(match, match[1], 'class'), ...methods];
}

function methodSymbol(source: Source, span: BlockSpan): Located {
	const open = source.masked.indexOf('(', span.start);
	const signature = signatureAt(source, open, span.name);
	return { index: span.start, name: span.name, kind: 'method', ...signature };
}

function signatureAt(
	source: Source,
	from: number,
	owner: string
): { inputs: ContractItem[]; output: string } {
	const open = source.masked.indexOf('(', from);
	const close = closingGroup(source.nesting, open);
	const inputs = parseParameters(
		source.code.slice(open + 1, close),
		source.masked.slice(open + 1, close),
		{ owner }
	);
	return { inputs, output: returnType(source, close) };
}

function returnType(source: Source, close: number): string {
	const rest = source.masked.slice(close + 1);
	if (!/^\s*:/.test(rest)) return 'unknown';
	const arrow = rest.search(/=>/);
	const end = bodyEnd(source.masked, source.nesting, close + 1);
	const body = end === -1 ? -1 : bodyStart(source.nesting, source.masked, close + 1, end);
	const stops = [arrow === -1 ? -1 : close + 1 + arrow, body].filter((stop) => stop !== -1);
	const stop = stops.length > 0 ? Math.min(...stops) : source.masked.length;
	return normalizeType(source.code.slice(close + 1, stop).replace(/^\s*:/, ''));
}

function bodyStart(nesting: SourceNesting, masked: string, from: number, end: number): number {
	for (let index = from; index < end; index += 1) {
		if (masked[index] === '{' && matchingBrace(nesting, index) === end) return index;
	}
	return -1;
}

function closingGroup(nesting: SourceNesting, open: number): number {
	const target = nesting.group[open];
	for (let index = open + 1; index < nesting.group.length - 1; index += 1) {
		if (nesting.group[index + 1] === target) return index;
	}
	return nesting.group.length - 2;
}

function listSymbols(match: RegExpExecArray): Located[] {
	const value = match[3] ? 'reexport' : 'const';
	const kind = match[1] ? 'type' : value;
	return match[2]
		.split(',')
		.map(
			(entry) =>
				entry
					.trim()
					.split(/\s+as\s+/)
					.at(-1)
					?.replace(/^type\s+/, '') ?? ''
		)
		.filter(Boolean)
		.map((name) => ({ index: match.index, name, kind, inputs: [] }) satisfies Located);
}

function thrownErrors(masked: string): string[] {
	const thrown = [...masked.matchAll(/\bthrow\s+new\s+([\w$.]+)/g)].map((match) => match[1]);
	const failed = /\bfail\s*\(/.test(masked) ? ['ExpectedCliError'] : [];
	const http = [...masked.matchAll(/\berror\(\s*(\d{3})\b/g)].map(
		(match) => `HttpError ${match[1]}`
	);
	return [...new Set([...thrown, ...failed, ...http])].sort();
}
