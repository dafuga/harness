export interface MaskOptions {
	/** Blank string, template and regular-expression contents as well as comments. */
	strings?: boolean;
}

interface Cursor {
	code: string;
	out: string[];
	index: number;
	strings: boolean;
	significant: string;
	word: string;
}

const openBrace = '\x7b';
const closeBrace = '\x7d';
const backtick = '\x60';
const regexPrefixes = new Set([...'(,=:[!&|?;+-*%<>~^', openBrace, closeBrace]);
const regexKeywords = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw']);

/** Returns same-length text with comments, and optionally literal contents, replaced by spaces. */
export function maskSource(code: string, options: MaskOptions = {}): string {
	const cursor: Cursor = {
		code,
		out: [],
		index: 0,
		strings: options.strings ?? true,
		significant: '',
		word: ''
	};
	maskCode(cursor, false);
	return cursor.out.join('');
}

function maskCode(cursor: Cursor, insideTemplate: boolean): void {
	let depth = 0;
	while (cursor.index < cursor.code.length) {
		const char = cursor.code[cursor.index];
		if (insideTemplate && char === closeBrace && depth === 0) return;
		if (char === openBrace) depth += 1;
		if (char === closeBrace) depth -= 1;
		maskToken(cursor, char);
	}
}

function maskToken(cursor: Cursor, char: string): void {
	const next = cursor.code[cursor.index + 1];
	if (char === '/' && next === '/') return blankUntil(cursor, '\n', 0);
	if (char === '/' && next === '*') return blankUntil(cursor, '*/', 2);
	if (char === '"' || char === "'") return maskString(cursor, char);
	if (char === backtick) return maskTemplate(cursor);
	if (char === '/' && regexAllowed(cursor)) return maskRegex(cursor);
	return keep(cursor, char);
}

function keep(cursor: Cursor, char: string): void {
	cursor.out.push(char);
	cursor.index += 1;
	if (/\s/.test(char)) return;
	cursor.word = /[\w$]/.test(char)
		? (/[\w$]/.test(cursor.significant) ? cursor.word : '') + char
		: '';
	cursor.significant = char;
}

function blank(cursor: Cursor, count: number, literal: boolean): void {
	for (let offset = 0; offset < count && cursor.index < cursor.code.length; offset += 1) {
		const char = cursor.code[cursor.index];
		cursor.out.push(char === '\n' || (literal && !cursor.strings) ? char : ' ');
		cursor.index += 1;
	}
}

function blankUntil(cursor: Cursor, terminator: string, consumed: number): void {
	const end = cursor.code.indexOf(terminator, cursor.index + 2);
	const stop = end === -1 ? cursor.code.length : end + consumed;
	blank(cursor, stop - cursor.index, false);
}

function emitDelimiter(cursor: Cursor, length: number): void {
	cursor.out.push(cursor.code.slice(cursor.index, cursor.index + length));
	cursor.index += length;
	cursor.significant = '"';
	cursor.word = '';
}

function maskString(cursor: Cursor, quote: string): void {
	emitDelimiter(cursor, 1);
	while (cursor.index < cursor.code.length) {
		const char = cursor.code[cursor.index];
		if (char === quote) emitDelimiter(cursor, 1);
		if (char === quote || char === '\n') return;
		blank(cursor, char === '\\' ? 2 : 1, true);
	}
}

function maskTemplate(cursor: Cursor): void {
	emitDelimiter(cursor, 1);
	while (cursor.index < cursor.code.length) {
		const char = cursor.code[cursor.index];
		if (char === backtick) break;
		if (char === '$' && cursor.code[cursor.index + 1] === openBrace) {
			emitDelimiter(cursor, 2);
			maskCode(cursor, true);
		} else blank(cursor, char === '\\' ? 2 : 1, true);
		if (char === '$' && cursor.code[cursor.index] === closeBrace) emitDelimiter(cursor, 1);
	}
	if (cursor.index < cursor.code.length) emitDelimiter(cursor, 1);
}

function regexAllowed(cursor: Cursor): boolean {
	if (regexEnd(cursor.code, cursor.index) === -1) return false;
	if (cursor.significant === '' || regexPrefixes.has(cursor.significant)) return true;
	return regexKeywords.has(cursor.word);
}

function maskRegex(cursor: Cursor): void {
	const end = regexEnd(cursor.code, cursor.index);
	emitDelimiter(cursor, 1);
	blank(cursor, end - cursor.index, true);
	emitDelimiter(cursor, 1);
}

/** Index of the closing slash of a regular expression literal on the same line, or -1. */
function regexEnd(code: string, start: number): number {
	let inClass = false;
	for (let index = start + 1; index < code.length; index += 1) {
		const char = code[index];
		if (char === '\n') return -1;
		if (char === '\\') index += 1;
		else if (char === '[') inClass = true;
		else if (char === ']') inClass = false;
		else if (char === '/' && !inClass) return index;
	}
	return -1;
}
