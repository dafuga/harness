import { bodyEnd, matchingBrace, sourceNesting, type SourceNesting } from "../sourceNesting";
import { statementEnd } from "./sourceNesting";

export interface BlockSpan {
	name: string;
	kind: 'function' | 'method';
	start: number;
	end: number;
}

interface Scope {
	masked: string;
	nesting: SourceNesting;
	depth: number;
	from: number;
	to: number;
	prefix: string;
}

const modifiers = '(?:(?:public|private|protected|static|override|readonly|async|get|set)\\s+)*';

const declared = /^[ \t]*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([\w$]+)/gm;

const variable = /^[ \t]*(?:export\s+)?(?:const|let|var)\s+([\w$]+)\b/gm;

const classStart = /^[ \t]*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([\w$]+)/gm;

const method = new RegExp(`^[ \\t]*${modifiers}\\*?\\s*(#?[\\w$]+)\\s*(?:<[^>(]*>)?\\s*\\(`, 'gm');

const property = new RegExp(`^[ \\t]*${modifiers}(#?[\\w$]+)\\s*(?:[:?][^=;\\n]*)?=(?!=)`, 'gm');

const controlWords = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function']);

/** Finds named top-level functions and class methods in masked TypeScript or JavaScript. */
export function blockSpans(masked: string): BlockSpan[] {
	const nesting = sourceNesting(masked);
	const top: Scope = { masked, nesting, depth: 0, from: 0, to: masked.length, prefix: '' };
	const spans = [
		...declaredSpans(top),
		...assignedSpans(top, variable),
		...candidates(top, classStart).flatMap((match) => classSpans(top, match))
	];
	return spans.sort((left, right) => left.start - right.start);
}

function candidates(scope: Scope, pattern: RegExp): RegExpExecArray[] {
	const text = scope.masked.slice(scope.from, scope.to);
	return [...text.matchAll(pattern)].filter((match) => {
		const name = scope.from + match.index + match[0].indexOf(match[1]);
		const base = scope.nesting.group[scope.from];
		return scope.nesting.brace[name] === scope.depth && scope.nesting.group[name] === base;
	});
}

function declaredSpans(scope: Scope): BlockSpan[] {
	return candidates(scope, declared).flatMap((match) => {
		const start = scope.from + match.index;
		const end = bodyEnd(scope.masked, scope.nesting, start + match[0].length);
		return end === -1 ? [] : [span(scope, match, 'function', end)];
	});
}

function assignedSpans(scope: Scope, pattern: RegExp): BlockSpan[] {
	return candidates(scope, pattern).flatMap((match) => {
		const start = scope.from + match.index;
		const end = statementEnd(scope.masked, scope.nesting, start + match[0].length);
		if (!isFunctionValue(scope, start, end)) return [];
		return [span(scope, match, scope.prefix ? 'method' : 'function', end)];
	});
}

function isFunctionValue(scope: Scope, start: number, end: number): boolean {
	const text = scope.masked.slice(start, end + 1);
	if (/=\s*(?:async\s+)?function\b/.test(text)) return true;
	const group = scope.nesting.group[start];
	const brace = scope.nesting.brace[start];
	for (let index = text.indexOf('=>'); index !== -1; index = text.indexOf('=>', index + 2)) {
		const at = start + index;
		if (scope.nesting.group[at] === group && scope.nesting.brace[at] === brace) return true;
	}
	return false;
}

function classSpans(scope: Scope, match: RegExpExecArray): BlockSpan[] {
	const open = scope.masked.indexOf('{', scope.from + match.index + match[0].length);
	if (open === -1) return [];
	const body: Scope = {
		...scope,
		depth: scope.depth + 1,
		from: open + 1,
		to: matchingBrace(scope.nesting, open),
		prefix: `${match[1]}.`
	};
	return [...methodSpans(body), ...assignedSpans(body, property)];
}

function methodSpans(scope: Scope): BlockSpan[] {
	return candidates(scope, method).flatMap((match) => {
		if (controlWords.has(match[1])) return [];
		const end = bodyEnd(
			scope.masked,
			scope.nesting,
			scope.from + match.index + match[0].length - 1
		);
		return end === -1 ? [] : [span(scope, match, 'method', end)];
	});
}

function span(
	scope: Scope,
	match: RegExpExecArray,
	kind: BlockSpan['kind'],
	end: number
): BlockSpan {
	const lead = /^[ \t]*/.exec(match[0])?.[0].length ?? 0;
	return { name: `${scope.prefix}${match[1]}`, kind, start: scope.from + match.index + lead, end };
}
