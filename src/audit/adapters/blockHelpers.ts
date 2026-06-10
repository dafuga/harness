import { harnessRuleLimits, type HarnessRuleLimits } from '../../rules/catalog';
import type { AuditFinding } from '../types';

interface BlockCandidate {
	start: number;
	lines: string[];
}

export function auditCurlyFunctions(
	path: string,
	lines: string[],
	startsFunction: (line: string) => boolean,
	limits: HarnessRuleLimits = harnessRuleLimits
): AuditFinding[] {
	return collectCurlyBlocks(lines, startsFunction).flatMap((block) =>
		auditFunctionBlock(path, block, limits)
	);
}

export function auditIndentedPythonBlocks(
	path: string,
	lines: string[],
	limits: HarnessRuleLimits = harnessRuleLimits
): AuditFinding[] {
	return collectIndentedBlocks(lines).flatMap((block) => auditFunctionBlock(path, block, limits));
}

function collectCurlyBlocks(
	lines: string[],
	startsFunction: (line: string) => boolean
): BlockCandidate[] {
	const blocks: BlockCandidate[] = [];
	let active: BlockCandidate | undefined;
	let depth = 0;

	lines.forEach((line, index) => {
		if (!active && startsFunction(line)) {
			active = { start: index, lines: [] };
			depth = 0;
		}
		if (!active) return;
		active.lines.push(line);
		depth += count(line, '{') - count(line, '}');
		if (depth <= 0 && line.includes('}')) {
			blocks.push(active);
			active = undefined;
		}
	});

	return blocks;
}

function collectIndentedBlocks(lines: string[]): BlockCandidate[] {
	const blocks: BlockCandidate[] = [];
	lines.forEach((line, index) => {
		if (/^\s*def\s+\w+/.test(line))
			blocks.push({ start: index, lines: pythonBlockLines(lines, index) });
	});
	return blocks;
}

function pythonBlockLines(lines: string[], start: number): string[] {
	const block: string[] = [lines[start]];
	const indent = leadingSpaces(lines[start]);
	for (const line of lines.slice(start + 1)) {
		if (line.trim() && leadingSpaces(line) <= indent) break;
		block.push(line);
	}
	return block;
}

function auditFunctionBlock(
	path: string,
	block: BlockCandidate,
	limits: HarnessRuleLimits
): AuditFinding[] {
	return [
		...auditBlockLength(path, block, limits),
		...auditBlockParameters(path, block, limits),
		...auditBlockComplexity(path, block, limits),
		...auditBlockNesting(path, block, limits)
	];
}

function auditBlockLength(
	path: string,
	block: BlockCandidate,
	limits: HarnessRuleLimits
): AuditFinding[] {
	if (block.lines.length <= limits.maxFunctionLines) return [];
	return [
		finding(
			path,
			'small-function',
			block,
			`${block.lines.length} lines. Limit is ${limits.maxFunctionLines}`
		)
	];
}

function auditBlockParameters(
	path: string,
	block: BlockCandidate,
	limits: HarnessRuleLimits
): AuditFinding[] {
	const count = parameterCount(block.lines[0]);
	if (count <= limits.maxParameters) return [];
	return [
		finding(path, 'max-parameters', block, `${count} parameters. Limit is ${limits.maxParameters}`)
	];
}

function auditBlockComplexity(
	path: string,
	block: BlockCandidate,
	limits: HarnessRuleLimits
): AuditFinding[] {
	const complexity = block.lines.reduce((total, line) => total + complexityPoints(line), 1);
	if (complexity <= limits.maxComplexity) return [];
	return [
		finding(
			path,
			'max-complexity',
			block,
			`complexity ${complexity}. Limit is ${limits.maxComplexity}`
		)
	];
}

function auditBlockNesting(
	path: string,
	block: BlockCandidate,
	limits: HarnessRuleLimits
): AuditFinding[] {
	const depth = Math.max(curlyDepth(block.lines), indentationDepth(block.lines));
	if (depth <= limits.maxNestingDepth) return [];
	return [
		finding(
			path,
			'max-nesting',
			block,
			`${depth} nested levels. Limit is ${limits.maxNestingDepth}`
		)
	];
}

function finding(path: string, rule: string, block: BlockCandidate, detail: string): AuditFinding {
	return {
		path,
		rule,
		message: `Block starting near line ${block.start + 1} has ${detail}.`
	};
}

function parameterCount(line: string): number {
	const match = line.match(/\(([^)]*)\)/);
	if (!match?.[1].trim()) return 0;
	return match[1].split(',').filter((part) => part.trim() && part.trim() !== 'self').length;
}

function complexityPoints(line: string): number {
	return line.match(/\b(if|for|while|case|catch|except|elif)\b|\?\s/g)?.length ?? 0;
}

function curlyDepth(lines: string[]): number {
	let depth = 0;
	let maximum = 0;
	for (const line of lines) {
		depth += count(line, '{') - count(line, '}');
		maximum = Math.max(maximum, depth);
	}
	return Math.max(0, maximum - 1);
}

function indentationDepth(lines: string[]): number {
	return Math.max(0, ...lines.map((line) => Math.floor(leadingSpaces(line) / 4)));
}

function leadingSpaces(line: string): number {
	return line.match(/^\s*/)?.[0].length ?? 0;
}

function count(value: string, token: string): number {
	return value.split(token).length - 1;
}
