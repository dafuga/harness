import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { test } from 'vitest';
import { rustAdapter } from '../../src/audit/development-tooling/adapters/rust';
import type { AuditFile } from '../../src/audit/development-tooling/adapters/types';
import { maskTemplateLiterals, splitLines } from '../../src/audit/development-tooling/commonRules';
import { harnessRuleLimits } from '../../src/rules/explorer-ui/catalog';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * rustAdapter.audit is called the way the audit calls it: each Rust source is written into a
 * temporary project folder, read back, made into the AuditFile the audit builds, and audited.
 */

const source = (...rows: string[]) => `${rows.join('\n')}\n`;

/** A 60-line function, over the 55-line limit, whose third line is `marker`. */
const frameRows = (signature: string, marker: string) => [
	signature,
	'    let mut frame = Vec::with_capacity(payload.len() + 2);',
	`    ${marker}`,
	...Array.from({ length: 55 }, (_, index) => `    frame.push(${index});`),
	'    frame',
	'}'
];
const encode = 'pub fn encode_frame(payload: &[u8]) -> Vec<u8> {';
const encodeFive =
	'pub fn encode_frame(payload: &[u8], mode: u8, flags: u8, id: u8, seq: u8) -> Vec<u8> {';
/** 221 lines, over the 220-line limit; with no final newline the split counts exactly 221. */
const longFile = Array.from({ length: 221 }, (_, i) => `pub const L${i}: u32 = ${i};`).join('\n');
const sameFrame = source(...frameRows(encodeFive, 'frame.push(0);'));

const longPath = 'crates/demo/src/long_file.rs';
const framePath = 'crates/demo/src/frame.rs';
const typeScriptPath = 'src/frame.ts';
const readPath = 'crates/demo/src/read.rs';
const maskPath = 'crates/demo/src/mask.rs';
const fileLines = 'File has 221 lines. Limit is 220. Split it by responsibility.';
const functionLines = 'Block starting near line 1 has 60 lines. Limit is 55.';
const parameterCount = 'Block starting near line 1 has 5 parameters. Limit is 4.';
const safetyLine2 = 'Unsafe code near line 2 needs a preceding // SAFETY: comment.';
const safetyLine6 = 'Unsafe code near line 6 needs a preceding // SAFETY: comment.';
const docLine1 = 'Unsafe function near line 1 needs a # Safety doc section.';
const docLine10 = 'Unsafe function near line 10 needs a # Safety doc section.';

const sizeSources = [
	{ name: 'a file of 221 lines is over the 220-line limit', path: longPath, contents: longFile },
	{ name: 'a 60-line function with five parameters', path: framePath, contents: sameFrame },
	{ name: 'a .ts file: extensions are not checked', path: typeScriptPath, contents: sameFrame }
];

const readByte = 'pub fn read_byte(pointer: *const u8) -> u8 {';
const safety = '    // SAFETY: the caller passes a pointer to a live byte.';
const cursor = ['    let start = pointer.wrapping_add(1);', '    let end = start;'];
const deeper = [...cursor, '    let last = end;'];
const blockSources = [
	{
		name: 'an unsafe block with no SAFETY comment above it is reported',
		path: readPath,
		contents: source(readByte, '    unsafe { *pointer }', '}')
	},
	{
		name: 'a SAFETY comment three lines above the unsafe block still passes',
		path: readPath,
		contents: source(readByte, safety, ...cursor, '    unsafe { *end }', '}')
	},
	{
		name: 'a SAFETY comment four lines above the unsafe block is too far away',
		path: readPath,
		contents: source(readByte, safety, ...deeper, '    unsafe { *last }', '}')
	}
];

const unsafeFn = 'pub unsafe fn read_byte(pointer: *const u8) -> u8 {';
const docs = ['/// # Safety', '/// The pointer must be valid for one read.'];
const notes = [
	'#[inline]',
	'#[must_use]',
	'// Callers hold the buffer lock while they read.',
	'// Keep this signature for the FFI layer.',
	'// Reviewed together with the pointer contract.',
	'// See the design notes for the buffer layout.'
];
const fnSources = [
	{
		name: 'an unsafe fn with no # Safety section above it is reported',
		path: readPath,
		contents: source(unsafeFn, '    *pointer', '}')
	},
	{
		name: 'a # Safety section eight lines above the unsafe fn still passes',
		path: readPath,
		contents: source(...docs, ...notes, unsafeFn, '    *pointer', '}')
	},
	{
		name: 'a # Safety section nine lines above the unsafe fn is too far away',
		path: readPath,
		contents: source(...docs, ...notes, '// Benchmarks live here.', unsafeFn, '    *pointer', '}')
	}
];

const maskingSources = [
	{
		name: "a '}' character literal does not end a 60-line function early",
		path: maskPath,
		contents: source(...frameRows(encode, "frame.push(b'}');"))
	},
	{
		name: 'unsafe text in a string literal and in a commented-out unsafe fn is not reported',
		path: maskPath,
		contents: source(
			"pub fn describe() -> &'static str {",
			'    // pub unsafe fn retired(pointer: *const u8) -> u8 {',
			'    "unsafe { read the raw pointer }"',
			'}'
		)
	},
	{
		name: 'a closing brace in a line comment does not end a 60-line function early',
		path: maskPath,
		contents: source(...frameRows(encode, '// closes the frame }'))
	}
];

/** Writes each source into the temporary folder, then audits it as the audit does. */
function auditSources(sources: Array<{ name: string; path: string; contents: string }>) {
	return withTempDir('rust-adapter-examples-', async (root) => {
		const cases = [];
		for (const { name, path, contents } of sources) {
			const absolutePath = join(root, path);
			await mkdir(dirname(absolutePath), { recursive: true });
			await writeFile(absolutePath, contents);
			const text = await readFile(absolutePath, 'utf8');
			const file: AuditFile = {
				absolutePath,
				relativePath: path,
				extension: extname(path),
				contents: text,
				lines: splitLines(text),
				structuralLines: splitLines(maskTemplateLiterals(text)),
				limits: harnessRuleLimits,
				size: Buffer.byteLength(text)
			};
			cases.push({ name, input: { path, contents }, output: rustAdapter.audit(file) });
		}
		return cases;
	});
}

/** Records one state's cases; its id is the test title in lowercase with hyphens. */
function record(state: string, cases: Array<{ name: string; input: unknown; output: unknown }>) {
	return recordExampleCases(
		{
			unitId: 'audit.adapters-rust',
			symbol: 'rustAdapter.audit',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Reports files and functions over the size limits', async () => {
	const cases = await auditSources(sizeSources);
	const [longFileCase, frameCase, typeScriptCase] = cases;
	expect(longFileCase.output).toEqual([{ path: longPath, rule: 'small-file', message: fileLines }]);
	expect(frameCase.output).toEqual([
		{ path: framePath, rule: 'small-function', message: functionLines },
		{ path: framePath, rule: 'max-parameters', message: parameterCount }
	]);
	expect(typeScriptCase.output).toEqual(
		frameCase.output.map((finding) => ({ ...finding, path: typeScriptPath }))
	);
	record('reports-files-and-functions-over-the-size-limits', cases);
});

test('Requires a SAFETY comment above unsafe blocks', async () => {
	const cases = await auditSources(blockSources);
	const [undocumented, threeAbove, fourAbove] = cases;
	expect(undocumented.output).toEqual([
		{ path: readPath, rule: 'rust-unsafe-comment', message: safetyLine2 }
	]);
	expect(threeAbove.output).toEqual([]);
	expect(fourAbove.output).toEqual([
		{ path: readPath, rule: 'rust-unsafe-comment', message: safetyLine6 }
	]);
	record('requires-a-safety-comment-above-unsafe-blocks', cases);
});

test('Requires a Safety section above unsafe functions', async () => {
	const cases = await auditSources(fnSources);
	const [noDoc, eightAbove, nineAbove] = cases;
	expect(noDoc.output).toEqual([
		{ path: readPath, rule: 'rust-unsafe-contract', message: docLine1 }
	]);
	expect(eightAbove.output).toEqual([]);
	expect(nineAbove.output).toEqual([
		{ path: readPath, rule: 'rust-unsafe-contract', message: docLine10 }
	]);
	record('requires-a-safety-section-above-unsafe-functions', cases);
});

test('Ignores braces and unsafe text inside literals and comments', async () => {
	const cases = await auditSources(maskingSources);
	const [charLiteral, text, lineComment] = cases;
	expect(charLiteral.output).toEqual([
		{ path: maskPath, rule: 'small-function', message: functionLines }
	]);
	expect(text.output).toEqual([]);
	expect(lineComment.output).toEqual([
		{ path: maskPath, rule: 'small-function', message: functionLines }
	]);
	record('ignores-braces-and-unsafe-text-inside-literals-and-comments', cases);
});
