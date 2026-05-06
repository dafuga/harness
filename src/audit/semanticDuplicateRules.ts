import { harnessRuleLimits } from '../rules/catalog';
import type { AuditFile } from './adapters/types';
import type { AuditFinding } from './types';

interface FunctionSignature {
	path: string;
	start: number;
	end: number;
	tokens: Set<string>;
}

const functionPattern = /^\s*(export\s+)?(async\s+)?(function\s+\w+|const\s+\w+\s*=.*=>)/;
const reservedWords = new Set([
	'async',
	'await',
	'const',
	'else',
	'for',
	'function',
	'if',
	'let',
	'new',
	'return',
	'throw',
	'while'
]);

export function auditSemanticDuplicates(files: AuditFile[]): AuditFinding[] {
	const signatures = files.flatMap((file) => functionSignatures(file));
	const findings: AuditFinding[] = [];

	for (let left = 0; left < signatures.length; left += 1) {
		for (let right = left + 1; right < signatures.length; right += 1) {
			const source = signatures[left];
			const duplicate = signatures[right];
			if (!isSemanticDuplicate(source, duplicate)) continue;
			findings.push(semanticFinding(source, duplicate));
		}
	}

	return findings;
}

function functionSignatures(file: AuditFile): FunctionSignature[] {
	return collectFunctionBlocks(file.structuralLines).flatMap((block) => {
		const tokens = semanticTokens(block.lines);
		if (tokens.size < harnessRuleLimits.minSemanticDuplicateTokens) return [];
		return [{ path: file.relativePath, start: block.start + 1, end: block.end + 1, tokens }];
	});
}

function collectFunctionBlocks(lines: string[]) {
	const blocks: Array<{ start: number; end: number; lines: string[] }> = [];
	let active: { start: number } | undefined;
	let depth = 0;

	lines.forEach((line, index) => {
		if (!active && startsFunctionLike(line)) {
			active = { start: index };
			depth = 0;
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

function startsFunctionLike(line: string): boolean {
	return functionPattern.test(line) && line.includes('{');
}

function semanticTokens(lines: string[]): Set<string> {
	const tokens = new Set<string>();

	lines.flatMap(splitStatements).forEach((statement) => {
		const normalized = normalizeStatement(statement);
		if (!normalized) return;
		tokens.add(`stmt:${normalized}`);
		operationTokens(normalized).forEach((token) => tokens.add(token));
	});

	return tokens;
}

function splitStatements(line: string): string[] {
	return line.split(';').map((statement) => statement.trim());
}

function normalizeStatement(statement: string): string {
	return statement
		.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, 'STR')
		.replace(/\b\d+(?:\.\d+)?\b/g, 'NUM')
		.replace(/[A-Za-z_$][\w$]*/g, (match, offset, source) =>
			normalizeIdentifier(match, offset, source)
		)
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeIdentifier(match: string, offset: number, source: string): string {
	if (reservedWords.has(match)) return match;
	if (source[offset - 1] === '.') return match;
	if (/^[A-Z][A-Za-z0-9_$]*$/.test(match)) return match;
	return 'ID';
}

function operationTokens(statement: string): string[] {
	return [
		...operatorTokens(statement),
		...callTokens(statement),
		statement.includes('return') ? 'flow:return' : '',
		statement.includes('if ') ? 'flow:branch' : '',
		statement.includes('for ') || statement.includes('while ') ? 'flow:loop' : ''
	].filter(Boolean);
}

function operatorTokens(statement: string): string[] {
	return Array.from(statement.matchAll(/[+\-*/%]|===?|!==?|>=?|<=?|\?\s|&&|\|\|/g)).map(
		(match) => `op:${match[0].trim()}`
	);
}

function callTokens(statement: string): string[] {
	return Array.from(statement.matchAll(/\b(?:ID|[A-Z]\w*|[a-z]\w*)\(/g)).map((match) => {
		const name = match[0].slice(0, -1);
		return `call:${name}`;
	});
}

function isSemanticDuplicate(left: FunctionSignature, right: FunctionSignature): boolean {
	if (left.path === right.path) return false;
	return similarity(left.tokens, right.tokens) >= harnessRuleLimits.minSemanticDuplicateSimilarity;
}

function similarity(left: Set<string>, right: Set<string>): number {
	const shared = [...left].filter((token) => right.has(token)).length;
	const total = new Set([...left, ...right]).size;
	return total === 0 ? 0 : shared / total;
}

function semanticFinding(source: FunctionSignature, duplicate: FunctionSignature): AuditFinding {
	return {
		path: duplicate.path,
		rule: 'duplicated-code',
		message: `Function near line ${duplicate.start} semantically duplicates ${source.path}:${source.start}-${source.end}. Extract shared behavior or remove the copy.`
	};
}

function count(value: string, token: string): number {
	return value.split(token).length - 1;
}
