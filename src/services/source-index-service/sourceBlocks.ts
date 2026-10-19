import { SourceBlock } from '../../utils/sourceBlocks';
import { createHash } from "node:crypto";
import { blockComplexity } from "../../utils/blockComplexity";
import { templateComplexity } from "./blockComplexity";
import { blockSpans, type BlockSpan } from "../../utils/block-spans/blockSpans";
import { maskSource } from "../../utils/maskSource";
import type { SourceLanguage } from "../../utils/scanImports";

interface Region {
	text: string;
	offset: number;
}

const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/g;

const stylePattern = /<style\b[^>]*>([\s\S]*?)<\/style>/g;

/** Splits a source file into named blocks used for change explanations and complexity. */
export function sourceBlocks(code: string, language: SourceLanguage): SourceBlock[] {
	if (language === 'ts') return scriptBlocks(code, [{ text: code, offset: 0 }]);
	if (language === 'svelte') return svelteBlocks(code);
	return [remainder('module', code, [1, lineOf(code, code.length)])];
}

function svelteBlocks(code: string): SourceBlock[] {
	const scripts = regions(code, scriptPattern);
	const styles = regions(code, stylePattern);
	const markup = code.replace(scriptPattern, '').replace(stylePattern, '');
	const lines: [number, number] = [1, lineOf(code, code.length)];
	const template = remainder('template', markup, lines, templateComplexity(markup));
	const style = styles.map((region) => remainder('style', region.text, regionLines(code, region)));
	return [...scriptBlocks(code, scripts), template, ...style.slice(0, 1)];
}

function scriptBlocks(code: string, scripts: Region[]): SourceBlock[] {
	const named: SourceBlock[] = [];
	const rest: string[] = [];
	for (const script of scripts) {
		const masked = maskSource(script.text);
		const clean = maskSource(script.text, { strings: false });
		const spans = blockSpans(masked);
		named.push(...spans.map((span) => namedBlock(code, script, { masked, clean, span })));
		rest.push(withoutSpans(clean, spans), withoutSpans(masked, spans));
	}
	const clean = rest.filter((_, index) => index % 2 === 0).join('\n');
	const masked = rest.filter((_, index) => index % 2 === 1).join('\n');
	const lines: [number, number] = [1, lineOf(code, code.length)];
	return [remainder('module', clean, lines, blockComplexity(masked, 0)), ...named];
}

function namedBlock(
	code: string,
	script: Region,
	input: { masked: string; clean: string; span: BlockSpan }
): SourceBlock {
	const { span } = input;
	return {
		name: span.name,
		kind: span.kind,
		startLine: lineOf(code, script.offset + span.start),
		endLine: lineOf(code, script.offset + span.end),
		hash: fingerprint(input.clean.slice(span.start, span.end + 1)),
		complexity: blockComplexity(input.masked.slice(span.start, span.end + 1), 1)
	};
}

function remainder(
	kind: 'module' | 'template' | 'style',
	text: string,
	lines: [number, number],
	complexity = 0
): SourceBlock {
	const [startLine, endLine] = lines;
	return { name: `<${kind}>`, kind, startLine, endLine, hash: fingerprint(text), complexity };
}

function withoutSpans(text: string, spans: BlockSpan[]): string {
	let result = '';
	let cursor = 0;
	for (const span of spans) {
		if (span.start < cursor) continue;
		result += text.slice(cursor, span.start);
		cursor = span.end + 1;
	}
	return result + text.slice(cursor);
}

function regions(code: string, pattern: RegExp): Region[] {
	return [...code.matchAll(pattern)].map((match) => ({
		text: match[1],
		offset: match.index + match[0].indexOf(match[1])
	}));
}

function regionLines(code: string, region: Region): [number, number] {
	return [lineOf(code, region.offset), lineOf(code, region.offset + region.text.length)];
}

function lineOf(code: string, index: number): number {
	let line = 1;
	for (let cursor = 0; cursor < index && cursor < code.length; cursor += 1) {
		if (code[cursor] === '\n') line += 1;
	}
	return code.endsWith('\n') && index >= code.length ? line - 1 : line;
}

function fingerprint(text: string): string {
	const normalized = text.replace(/\s+/g, ' ').trim();
	return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}
