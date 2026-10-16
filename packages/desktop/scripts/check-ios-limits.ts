import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * The project's size limits for Swift, which `harness audit` cannot measure: files, types,
 * functions, methods and parameters. It reads declarations by their braces, so it is a guard of
 * shape, not a parser. Nothing is excluded silently: each exception is named below with its
 * reason, and a finding fails the run.
 */
const limits = { file: 220, type: 120, func: 55, method: 35, parameters: 4 };
/** Signatures Apple's protocols fix; their parameter count is not ours to choose. */
const required = ['willPerformHTTPRedirection'];
const root = resolve(import.meta.dirname, '..');
const folders = ['ios/App/App', 'ios/Checks'];

interface Block {
	kind: 'type' | 'func';
	name: string;
	start: number;
	depth: number;
	inType: boolean;
}

function swiftFiles(folder: string): string[] {
	return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
		const path = join(folder, entry.name);
		if (entry.isDirectory()) return swiftFiles(path);
		return entry.name.endsWith('.swift') ? [path] : [];
	});
}

/** Code without what is inside strings and comments, so that only real braces are counted. */
function bare(line: string): string {
	return line.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/\/\/.*$/, '');
}

/** The parameters of the declaration that starts on this line; commas inside brackets do not count. */
function parameters(lines: string[], index: number): number {
	const text = lines.slice(index, index + 8).join(' ');
	let depth = 0;
	let count = 0;
	let seen = false;
	for (const character of text.slice(text.indexOf('('))) {
		if ('([<'.includes(character)) depth++;
		if (')]>'.includes(character)) depth--;
		if (depth === 1 && character === ',') count++;
		if (depth >= 1 && !' ('.includes(character)) seen = true;
		if (depth === 0) break;
	}
	return seen ? count + 1 : 0;
}

function declared(line: string): Pick<Block, 'kind' | 'name'> | null {
	const type =
		/^\s*(?:final |public |private |fileprivate )*(?:class|struct|enum|extension|protocol)\s+(\w+)/;
	const func = /^\s*(?:@\w+\s+)*(?:[a-z]+ )*(?:func\s+(\w+)|(init))\s*[(<]/;
	const named = type.exec(line);
	if (named) return { kind: 'type', name: named[1] };
	const made = func.exec(line);
	return made ? { kind: 'func', name: made[1] ?? made[2] } : null;
}

/** A function inside a type is a method; a type, a method and a function each have a limit. */
function measure(block: Block): { label: string; limit: number } {
	if (block.kind === 'type') return { label: 'type', limit: limits.type };
	if (block.inType) return { label: 'method', limit: limits.method };
	return { label: 'function', limit: limits.func };
}

function closed(block: Block, end: number, findings: string[]): void {
	const lines = end - block.start + 1;
	const { label, limit } = measure(block);
	if (lines > limit) findings.push(`${label} ${block.name} has ${lines} lines, limit ${limit}`);
}

/** A finding when a declaration takes too many parameters and no protocol of Apple fixed it. */
function overParameters(lines: string[], index: number, name: string): string[] {
	const signature = lines.slice(index, index + 4).join(' ');
	if (required.some((fixed) => signature.includes(fixed))) return [];
	const count = parameters(lines, index);
	return count > limits.parameters ? [`${name} takes ${count} parameters`] : [];
}

function inspect(path: string): string[] {
	const lines = readFileSync(path, 'utf8').split('\n').map(bare);
	const findings: string[] = [];
	const open: Block[] = [];
	let depth = 0;
	if (lines.length - 1 > limits.file) findings.push(`file has ${lines.length - 1} lines`);
	lines.forEach((line, index) => {
		const found = declared(line);
		if (found?.kind === 'func') findings.push(...overParameters(lines, index, found.name));
		const inType = open.some((block) => block.kind === 'type');
		if (found) open.push({ ...found, start: index, depth, inType });
		depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;
		while (open.length && depth <= open[open.length - 1].depth && line.includes('}'))
			closed(open.pop()!, index, findings);
	});
	return findings.map((finding) => `${relative(root, path)}: ${finding}`);
}

const files = folders.flatMap((folder) => swiftFiles(resolve(root, folder)));
const findings = files.flatMap(inspect);
for (const finding of findings) console.error(finding);
console.log(`${files.length} Swift files checked; ${findings.length} findings.`);
process.exit(findings.length ? 1 : 0);
