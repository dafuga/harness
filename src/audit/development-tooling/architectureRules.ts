import { join } from 'node:path';
import type { AuditFinding } from './types';
import ts from 'typescript';
import type { AuditFile } from './adapters/types';

/** Named declarations belong in a sibling type module, rather than beside executable code. */
export function auditTypePlacement(file: AuditFile): AuditFinding[] {
	if (file.relativePath.endsWith('.d.ts')) return [];
	const contents =
		file.extension === '.svelte'
			? [...file.contents.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
					.map((match) => match[1])
					.join('\n')
			: file.contents;
	const tree = ts.createSourceFile(file.relativePath, contents, ts.ScriptTarget.Latest, true);
	const runtime = tree.statements.some(
		(node) =>
			!(
				ts.canHaveModifiers(node) &&
				ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)
			) &&
			(ts.isClassDeclaration(node) ||
				ts.isFunctionDeclaration(node) ||
				ts.isVariableStatement(node) ||
				ts.isEnumDeclaration(node) ||
				ts.isExpressionStatement(node) ||
				ts.isExportAssignment(node))
	);
	if (!runtime) return [];
	if (file.relativePath.endsWith('.types.ts'))
		return [
			{
				path: file.relativePath,
				rule: 'separate-type-declarations',
				message:
					'Keep runtime implementations outside type files; retain type-only declarations and compatibility re-exports here.'
			}
		];
	const findings: AuditFinding[] = [];
	const visit = (node: ts.Node) => {
		if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node))
			findings.push({
				path: file.relativePath,
				rule: 'separate-type-declarations',
				message: `Move ${node.name.text} to a sibling .types.ts file and import its type.`
			});
		ts.forEachChild(node, visit);
	};
	visit(tree);
	return findings;
}

export function auditArchitecture(path: string, lines: string[]): AuditFinding[] {
	return lines.flatMap((line, index) => architectureFinding(path, line, index));
}

function architectureFinding(path: string, line: string, index: number): AuditFinding[] {
	const source = importSource(line);
	if (!source) return [];

	if (
		path.startsWith('src/core/') &&
		/\/(templates|workflows|commands)\//.test(resolvedImport(path, source))
	) {
		return [
			boundaryFinding(
				path,
				index,
				'architecture-boundaries',
				'Core modules cannot import templates, workflows, or commands.'
			)
		];
	}

	if (
		path.startsWith('src/templates/') &&
		/\/(workflows|commands)\//.test(resolvedImport(path, source))
	) {
		return [
			boundaryFinding(
				path,
				index,
				'architecture-boundaries',
				'Template modules cannot import workflows or commands.'
			)
		];
	}

	if (
		path.startsWith('src/commands/') &&
		/\/(templates|core\/files|core\/fields)\b/.test(resolvedImport(path, source))
	) {
		return [
			boundaryFinding(
				path,
				index,
				'thin-command-modules',
				'Command modules should delegate instead of importing templates or file-generation helpers.'
			)
		];
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
