import { join } from 'node:path';
import type { AuditFinding } from './types';

export function auditArchitecture(path: string, lines: string[]): AuditFinding[] {
	return lines.flatMap((line, index) => architectureFinding(path, line, index));
}

function architectureFinding(path: string, line: string, index: number): AuditFinding[] {
	const source = importSource(line);
	if (!source) return [];

	if (path.startsWith('src/core/') && /\/(templates|workflows|commands)\//.test(resolvedImport(path, source))) {
		return [boundaryFinding(path, index, 'architecture-boundaries', 'Core modules cannot import templates, workflows, or commands.')];
	}

	if (path.startsWith('src/templates/') && /\/(workflows|commands)\//.test(resolvedImport(path, source))) {
		return [boundaryFinding(path, index, 'architecture-boundaries', 'Template modules cannot import workflows or commands.')];
	}

	if (path.startsWith('src/commands/') && /\/(templates|core\/files|core\/fields)\b/.test(resolvedImport(path, source))) {
		return [boundaryFinding(path, index, 'thin-command-modules', 'Command modules should delegate instead of importing templates or file-generation helpers.')];
	}

	return [];
}

function boundaryFinding(path: string, index: number, rule: string, message: string): AuditFinding {
	return { path, rule, message: `${message} Import starts near line ${index + 1}.` };
}

function importSource(line: string): string | undefined {
	return line.match(/from\s+['"]([^'"]+)['"]/)?.[1];
}

function resolvedImport(path: string, source: string): string {
	if (!source.startsWith('.')) return source;
	return join(path, '..', source).replaceAll('\\', '/');
}
