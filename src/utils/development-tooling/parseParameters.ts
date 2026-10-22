import type { ContractItem } from '../../core/development-tooling/unitTypes';

const openers = new Set(['(', '[', '{', '<']);
const closers = new Set([')', ']', '}']);
const parameterModifiers = /^(?:(?:public|private|protected|readonly|override)\s+)+/;

/** Splits text on separators that are not nested inside brackets or generics. */
export function splitTopLevel(masked: string, separators: string): number[] {
	const cuts: number[] = [];
	let depth = 0;
	for (let index = 0; index < masked.length; index += 1) {
		const char = masked[index];
		if (openers.has(char)) depth += 1;
		else if (closers.has(char) || (char === '>' && masked[index - 1] !== '=')) depth -= 1;
		else if (depth === 0 && separators.includes(char)) cuts.push(index);
	}
	return cuts;
}

/** Reads `name: type` pairs from a parameter list or an object type literal. */
export function parseParameters(
	code: string,
	masked: string,
	options: { owner: string; separators?: string }
): ContractItem[] {
	const cuts = [-1, ...splitTopLevel(masked, options.separators ?? ','), masked.length];
	const items: ContractItem[] = [];
	for (let index = 0; index < cuts.length - 1; index += 1) {
		const from = cuts[index] + 1;
		const item = parameter(code.slice(from, cuts[index + 1]), masked.slice(from, cuts[index + 1]));
		if (item) items.push({ name: `${options.owner}.${item.name}`, type: item.type });
	}
	return items;
}

function parameter(code: string, masked: string): ContractItem | undefined {
	const lead = masked.length - masked.trimStart().length;
	const text = masked.slice(lead).replace(/^\.\.\./, '   ');
	const skipped = lead + (parameterModifiers.exec(text)?.[0].length ?? 0);
	const body = masked.slice(skipped);
	if (!body.trim()) return undefined;
	const colon = splitTopLevel(body, ':')[0] ?? -1;
	const equals = splitTopLevel(body, '=').find((cut) => body[cut + 1] !== '>') ?? body.length;
	const nameEnd = colon !== -1 && colon < equals ? colon : equals;
	const type =
		colon !== -1 && colon < equals ? code.slice(skipped + colon + 1, skipped + equals) : '';
	return { name: parameterName(body.slice(0, nameEnd)), type: normalizeType(type) };
}

function parameterName(text: string): string {
	const name = /^[\s.]*([\w$]+)/.exec(text)?.[1];
	return name ?? 'input';
}

export function normalizeType(text: string): string {
	const type = text.replace(/\s+/g, ' ').trim().replace(/[;,]$/, '').trim();
	return type || 'unknown';
}
