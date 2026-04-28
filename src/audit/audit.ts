import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

export interface AuditFinding {
	path: string;
	rule: string;
	message: string;
}

const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'coverage', '.svelte-kit', 'build']);

export async function auditPath(root: string): Promise<AuditFinding[]> {
	const files = await collectFiles(root);
	const findings = await Promise.all(files.map((file) => auditFile(root, file)));
	return findings.flat();
}

async function collectFiles(root: string): Promise<string[]> {
	const entries = await readdir(root);
	const nested = await Promise.all(entries.map((entry) => collectEntry(root, entry)));
	return nested.flat();
}

async function collectEntry(root: string, entry: string): Promise<string[]> {
	const path = join(root, entry);
	const details = await stat(path);

	if (details.isDirectory()) {
		return ignoredDirs.has(entry) ? [] : collectFiles(path);
	}

	return isAuditedFile(path) ? [path] : [];
}

function isAuditedFile(path: string): boolean {
	return ['.ts', '.svelte', '.js'].some((extension) => path.endsWith(extension));
}

async function auditFile(root: string, path: string): Promise<AuditFinding[]> {
	const contents = await readFile(path, 'utf8');
	const lines = contents.split('\n');
	const findings: AuditFinding[] = [];
	const displayPath = relative(root, path);

	if (lines.length > 220) {
		findings.push({
			path: displayPath,
			rule: 'small-file',
			message: `File has ${lines.length} lines. Split it by responsibility.`
		});
	}

	for (const finding of auditFunctionLengths(displayPath, lines)) {
		findings.push(finding);
	}

	return findings;
}

function auditFunctionLengths(path: string, lines: string[]): AuditFinding[] {
	const findings: AuditFinding[] = [];
	let start = 0;
	let depth = 0;
	let inFunction = false;

	lines.forEach((line, index) => {
		if (!inFunction && startsFunction(line)) {
			inFunction = true;
			start = index;
			depth = 0;
		}

		if (!inFunction) return;

		depth += count(line, '{') - count(line, '}');

		if (depth <= 0 && line.includes('}')) {
			const length = index - start + 1;
			if (length > 55) {
				findings.push({
					path,
					rule: 'small-function',
					message: `Function starting near line ${start + 1} has ${length} lines. Extract a named helper.`
				});
			}
			inFunction = false;
		}
	});

	return findings;
}

function startsFunction(line: string): boolean {
	return /\b(function|async function)\b/.test(line) || /\)\s*[:\w<>,\s[\]|]*\s*\{/.test(line);
}

function count(value: string, token: string): number {
	return value.split(token).length - 1;
}
