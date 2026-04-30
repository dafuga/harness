import { harnessRuleLimits } from '../../rules/catalog';
import type { AuditFinding } from '../types';

interface BlockCandidate {
	start: number;
	lines: string[];
}

export function auditCurlyFunctions(
	path: string,
	lines: string[],
	startsFunction: (line: string) => boolean
): AuditFinding[] {
	return collectCurlyBlocks(lines, startsFunction).flatMap((block) =>
		auditFunctionBlock(path, block)
	);
}

export function auditIndentedPythonBlocks(path: string, lines: string[]): AuditFinding[] {
	return collectIndentedBlocks(lines).flatMap((block) => auditFunctionBlock(path, block));
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

function auditFunctionBlock(path: string, block: BlockCandidate): AuditFinding[] {
	return [
		...auditBlockLength(path, block),
		...auditBlockParameters(path, block),
		...auditBlockComplexity(path, block),
		...auditBlockNesting(path, block)
	];
}

function auditBlockLength(path: string, block: BlockCandidate): AuditFinding[] {
	if (block.lines.length <= harnessRuleLimits.maxFunctionLines) return [];
	return [finding(path, 'small-function', block, `${block.lines.length} lines`)];
}

function auditBlockParameters(path: string, block: BlockCandidate): AuditFinding[] {
	const count = parameterCount(block.lines[0]);
	if (count <= harnessRuleLimits.maxParameters) return [];
	return [finding(path, 'max-parameters', block, `${count} parameters`)];
}

function auditBlockComplexity(path: string, block: BlockCandidate): AuditFinding[] {
	const complexity = block.lines.reduce((total, line) => total + complexityPoints(line), 1);
	if (complexity <= harnessRuleLimits.maxComplexity) return [];
	return [finding(path, 'max-complexity', block, `complexity ${complexity}`)];
}

function auditBlockNesting(path: string, block: BlockCandidate): AuditFinding[] {
	const depth = Math.max(curlyDepth(block.lines), indentationDepth(block.lines));
	if (depth <= harnessRuleLimits.maxNestingDepth) return [];
	return [finding(path, 'max-nesting', block, `${depth} nested levels`)];
}

function finding(path: string, rule: string, block: BlockCandidate, detail: string): AuditFinding {
	return { path, rule, message: `Block starting near line ${block.start + 1} has ${detail}.` };
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
