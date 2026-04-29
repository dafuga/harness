import { frameRuleLimits } from '../rules/catalog';
import type { AuditFinding, Block } from './types';

const methodPattern = new RegExp(String.raw`^\s*(async\s+)?\w+\([^)]*\)\s*[:\w<>,\s[\]|]*\s*\{`);

export function auditBlocks(path: string, lines: string[]): AuditFinding[] {
	return collectBlocks(lines).flatMap((block) => auditBlock(path, block));
}

function collectBlocks(lines: string[]): Block[] {
	const blocks: Block[] = [];
	let active: Block | undefined;
	let depth = 0;

	lines.forEach((line, index) => {
		if (!active) {
			active = startBlock(line, index);
			depth = active ? 0 : depth;
		}

		if (!active) return;

		depth += count(line, '{') - count(line, '}');
		if (depth <= 0 && line.includes('}')) {
			blocks.push({ ...active, end: index, lines: lines.slice(active.start, index + 1) });
			active = undefined;
		}
	});

	return blocks;
}

function startBlock(line: string, index: number): Block | undefined {
	if (startsClass(line)) return { kind: 'class', start: index, end: index, lines: [] };
	if (startsMethod(line)) return { kind: 'method', start: index, end: index, lines: [] };
	if (startsFunction(line)) return { kind: 'function', start: index, end: index, lines: [] };
	return undefined;
}

function auditBlock(path: string, block: Block): AuditFinding[] {
	if (block.kind === 'class') {
		return [...auditBlockLength(path, block), ...auditClassName(path, block), ...auditClassMethods(path, block)];
	}

	return [
		...auditBlockLength(path, block),
		...auditParameters(path, block),
		...auditComplexity(path, block),
		...auditNesting(path, block)
	];
}

function auditBlockLength(path: string, block: Block): AuditFinding[] {
	const length = block.end - block.start + 1;
	const max = block.kind === 'class' ? frameRuleLimits.maxClassLines : lineLimit(block.kind);

	if (length <= max) return [];

	return [
		{
			path,
			rule: lengthRule(block.kind),
			message: `${capitalize(block.kind)} starting near line ${block.start + 1} has ${length} lines. Limit is ${max}.`
		}
	];
}

function lengthRule(kind: Block['kind']): string {
	if (kind === 'class') return 'small-class';
	if (kind === 'function') return 'small-function';
	return 'method-length';
}

function auditParameters(path: string, block: Block): AuditFinding[] {
	const count = parameterCount(block.lines[0]);
	if (count <= frameRuleLimits.maxParameters) return [];

	return [
		{
			path,
			rule: 'max-parameters',
			message: `${capitalize(block.kind)} starting near line ${block.start + 1} has ${count} parameters. Limit is ${frameRuleLimits.maxParameters}.`
		}
	];
}

function auditComplexity(path: string, block: Block): AuditFinding[] {
	const complexity = block.lines.reduce((total, line) => total + complexityPoints(line), 1);
	if (complexity <= frameRuleLimits.maxComplexity) return [];

	return [
		{
			path,
			rule: 'max-complexity',
			message: `${capitalize(block.kind)} starting near line ${block.start + 1} has complexity ${complexity}. Limit is ${frameRuleLimits.maxComplexity}.`
		}
	];
}

function auditNesting(path: string, block: Block): AuditFinding[] {
	const depth = maxDepth(block.lines);
	if (depth <= frameRuleLimits.maxNestingDepth) return [];

	return [
		{
			path,
			rule: 'max-nesting',
			message: `${capitalize(block.kind)} starting near line ${block.start + 1} nests ${depth} levels. Limit is ${frameRuleLimits.maxNestingDepth}.`
		}
	];
}

function auditClassName(path: string, block: Block): AuditFinding[] {
	if (!/\bclass\s+\w*Manager\b/.test(block.lines[0])) return [];

	return [
		{
			path,
			rule: 'no-manager-name',
			message: `Class starting near line ${block.start + 1} uses a catch-all Manager name.`
		}
	];
}

function auditClassMethods(path: string, block: Block): AuditFinding[] {
	return collectMethods(block.lines, block.start).flatMap((method) => auditBlock(path, method));
}

function collectMethods(lines: string[], offset: number): Block[] {
	const methods: Block[] = [];
	let active: Block | undefined;
	let depth = 0;

	lines.forEach((line, index) => {
		if (!active && startsMethod(line)) {
			active = { kind: 'method', start: offset + index, end: offset + index, lines: [] };
			depth = 0;
		}

		if (!active) return;

		depth += count(line, '{') - count(line, '}');
		if (depth <= 0 && line.includes('}')) {
			methods.push({ ...active, end: offset + index, lines: lines.slice(active.start - offset, index + 1) });
			active = undefined;
		}
	});

	return methods;
}

function startsClass(line: string): boolean {
	return /\bclass\s+\w+/.test(line);
}

function startsFunction(line: string): boolean {
	return /\b(function|async function)\b/.test(line) || /^\s*(export\s+)?const\s+\w+\s*=.*=>/.test(line);
}

function startsMethod(line: string): boolean {
	return methodPattern.test(line);
}

function lineLimit(kind: Block['kind']): number {
	return kind === 'method' ? frameRuleLimits.maxMethodLines : frameRuleLimits.maxFunctionLines;
}

function parameterCount(line: string): number {
	const match = line.match(/\(([^)]*)\)/);
	if (!match?.[1].trim()) return 0;
	return match[1].split(',').filter(Boolean).length;
}

function complexityPoints(line: string): number {
	if (line.includes('return /')) {
		return 0;
	}

	const branchTokens = line.match(/\b(if|for|while|case|catch)\b|\?\s/g);
	return branchTokens?.length ?? 0;
}

function maxDepth(lines: string[]): number {
	let depth = 0;
	let maximum = 0;

	for (const line of lines) {
		if (startsControlBlock(line)) {
			depth += 1;
			maximum = Math.max(maximum, depth);
		}

		if (line.includes('}')) {
			depth = Math.max(0, depth - count(line, '}'));
		}
	}

	return maximum;
}

function startsControlBlock(line: string): boolean {
	return /\b(if|for|while|switch|catch)\b.*\{/.test(line);
}

function count(value: string, token: string): number {
	return value.split(token).length - 1;
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}
