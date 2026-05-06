import { harnessRuleLimits } from '../rules/catalog';
import type { AuditFile } from './adapters/types';
import { auditSemanticDuplicates } from './semanticDuplicateRules';
import type { AuditFinding } from './types';

interface DuplicateWindow {
	path: string;
	start: number;
	end: number;
}

interface NormalizedLine {
	text: string;
	line: number;
}

export function auditDuplicatedCode(files: AuditFile[]): AuditFinding[] {
	const windows = collectWindows(files);
	const reported = new Map<string, DuplicateWindow[]>();
	const findings: AuditFinding[] = [];

	for (const group of windows.values()) {
		if (group.length < 2) continue;
		const source = group[0];
		for (const duplicate of group.slice(1)) {
			if (overlapsReported(reported, duplicate)) continue;
			trackReported(reported, duplicate);
			findings.push(duplicateFinding(source, duplicate));
		}
	}

	return [...findings, ...auditSemanticDuplicates(files)];
}

function collectWindows(files: AuditFile[]): Map<string, DuplicateWindow[]> {
	const windows = new Map<string, DuplicateWindow[]>();

	for (const file of files) {
		for (const window of fileWindows(file)) {
			const group = windows.get(window.key) ?? [];
			group.push(window.location);
			windows.set(window.key, group);
		}
	}

	return windows;
}

function fileWindows(file: AuditFile): Array<{ key: string; location: DuplicateWindow }> {
	const lines = normalizeLines(file.structuralLines);
	const limit = harnessRuleLimits.minDuplicateLines;
	const windows: Array<{ key: string; location: DuplicateWindow }> = [];

	for (let index = 0; index <= lines.length - limit; index += 1) {
		const block = lines.slice(index, index + limit);
		const key = block.map((line) => line.text).join('\n');
		if (key.length < harnessRuleLimits.minDuplicateCharacters) continue;
		windows.push({
			key,
			location: {
				path: file.relativePath,
				start: block[0].line,
				end: block[block.length - 1].line
			}
		});
	}

	return windows;
}

function normalizeLines(lines: string[]): NormalizedLine[] {
	return lines.flatMap((line, index) => {
		const text = line.trim().replace(/\s+/g, ' ');
		if (!text || isCommentOnly(text)) return [];
		return [{ text, line: index + 1 }];
	});
}

function isCommentOnly(text: string): boolean {
	return (
		text.startsWith('//') ||
		text.startsWith('#') ||
		text.startsWith('*') ||
		text.startsWith('/*') ||
		text.startsWith('*/')
	);
}

function overlapsReported(
	reported: Map<string, DuplicateWindow[]>,
	window: DuplicateWindow
): boolean {
	return (reported.get(window.path) ?? []).some((existing) => windowsOverlap(existing, window));
}

function windowsOverlap(left: DuplicateWindow, right: DuplicateWindow): boolean {
	return left.start <= right.end && right.start <= left.end;
}

function trackReported(reported: Map<string, DuplicateWindow[]>, window: DuplicateWindow): void {
	const windows = reported.get(window.path) ?? [];
	windows.push(window);
	reported.set(window.path, windows);
}

function duplicateFinding(source: DuplicateWindow, duplicate: DuplicateWindow): AuditFinding {
	return {
		path: duplicate.path,
		rule: 'duplicated-code',
		message: `${harnessRuleLimits.minDuplicateLines} meaningful lines duplicate ${source.path}:${source.start}-${source.end}. Extract shared code or remove the copy.`
	};
}
