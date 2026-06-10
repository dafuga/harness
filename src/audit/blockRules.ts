import { harnessRuleLimits, type HarnessRuleLimits } from '../rules/catalog';
import { capitalize, complexityPoints, count, maxDepth, parameterCount } from './blockMetrics';
import type { AuditFinding, Block } from './types';

const methodPattern = new RegExp(String.raw`^\s*(async\s+)?\w+\([^)]*\)\s*[:\w<>,\s[\]|]*\s*\{`);

export function auditBlocks(
	path: string,
	lines: string[],
	limits: HarnessRuleLimits = harnessRuleLimits
): AuditFinding[] {
	return collectBlocks(lines).flatMap((block) => auditBlock(path, block, limits));
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

function auditBlock(path: string, block: Block, limits: HarnessRuleLimits): AuditFinding[] {
	if (block.kind === 'class') {
		return [
			...auditBlockLength(path, block, limits),
			...auditClassName(path, block),
			...auditClassMethods(path, block, limits)
		];
	}

	return [
		...auditBlockLength(path, block, limits),
		...auditParameters(path, block, limits),
		...auditComplexity(path, block, limits),
		...auditNesting(path, block, limits)
	];
}

function auditBlockLength(path: string, block: Block, limits: HarnessRuleLimits): AuditFinding[] {
	const length = block.end - block.start + 1;
	const max = block.kind === 'class' ? limits.maxClassLines : lineLimit(block.kind, limits);

	if (length <= max) return [];

	return [
		finding(
			path,
			lengthRule(block.kind),
			`${capitalize(block.kind)} starting near line ${block.start + 1} has ${length} lines. Limit is ${max}.`
		)
	];
}

function lengthRule(kind: Block['kind']): string {
	if (kind === 'class') return 'small-class';
	if (kind === 'function') return 'small-function';
	return 'method-length';
}

function auditParameters(path: string, block: Block, limits: HarnessRuleLimits): AuditFinding[] {
	const count = parameterCount(block.lines[0]);
	if (count <= limits.maxParameters) return [];

	return [
		finding(
			path,
			'max-parameters',
			`${capitalize(block.kind)} starting near line ${block.start + 1} has ${count} parameters. Limit is ${limits.maxParameters}.`
		)
	];
}

function auditComplexity(path: string, block: Block, limits: HarnessRuleLimits): AuditFinding[] {
	const complexity = block.lines.reduce((total, line) => total + complexityPoints(line), 1);
	if (complexity <= limits.maxComplexity) return [];

	return [
		finding(
			path,
			'max-complexity',
			`${capitalize(block.kind)} starting near line ${block.start + 1} has complexity ${complexity}. Limit is ${limits.maxComplexity}.`
		)
	];
}

function auditNesting(path: string, block: Block, limits: HarnessRuleLimits): AuditFinding[] {
	const depth = maxDepth(block.lines);
	if (depth <= limits.maxNestingDepth) return [];

	return [
		finding(
			path,
			'max-nesting',
			`${capitalize(block.kind)} starting near line ${block.start + 1} nests ${depth} levels. Limit is ${limits.maxNestingDepth}.`
		)
	];
}

function auditClassName(path: string, block: Block): AuditFinding[] {
	if (!/\bclass\s+\w*Manager\b/.test(block.lines[0])) return [];

	return [
		finding(
			path,
			'no-manager-name',
			`Class starting near line ${block.start + 1} uses a catch-all Manager name.`
		)
	];
}

function auditClassMethods(path: string, block: Block, limits: HarnessRuleLimits): AuditFinding[] {
	return collectMethods(block.lines, block.start).flatMap((method) =>
		auditBlock(path, method, limits)
	);
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
			methods.push({
				...active,
				end: offset + index,
				lines: lines.slice(active.start - offset, index + 1)
			});
			active = undefined;
		}
	});

	return methods;
}

function startsClass(line: string): boolean {
	return /^\s*(export\s+)?class\s+\w+/.test(line);
}

function startsFunction(line: string): boolean {
	return (
		/^\s*(export\s+)?(async\s+)?function\s+\w+/.test(line) ||
		/^\s*(export\s+)?const\s+\w+\s*=.*=>/.test(line)
	);
}

function startsMethod(line: string): boolean {
	return methodPattern.test(line);
}

function lineLimit(kind: Block['kind'], limits: HarnessRuleLimits): number {
	return kind === 'method' ? limits.maxMethodLines : limits.maxFunctionLines;
}

function finding(path: string, rule: string, message: string): AuditFinding {
	return { path, rule, message };
}
