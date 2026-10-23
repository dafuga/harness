import ts from 'typescript';
import { scanExports } from '../../../utils/development-tooling/scanExports';
import type { ExportPlan } from '../../../core/projects-sessions/exports';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function applyExports(root: string, plans: ExportPlan[]): Promise<boolean> {
	if (plans.length === 0) {
		return false;
	}

	const target = join(root, 'src/index.ts');
	const current = await readFile(target, 'utf8');
	const next = appendMissingExports(current, plans);

	if (next === current) {
		return false;
	}

	await writeFile(target, next);
	return true;
}

export function appendMissingExports(contents: string, plans: ExportPlan[]): string {
	let next = contents;
	for (const plan of plans) {
		const named = plan.source.startsWith('./helpers/') ? helperBindings(next, plan) : plan.named;
		const additions = exportLines({ ...plan, named }).filter((line) => !next.includes(line));
		if (!additions.length) continue;
		const separator = next.length === 0 || next.endsWith('\n') ? '' : '\n';
		next += `${separator}${additions.join('\n')}\n`;
	}
	return next;
}

/** Preserve existing SDK bindings when two scaffold kinds use the same requested name. */
function helperBindings(contents: string, plan: ExportPlan): string[] {
	const existing = helperImports(contents, plan.source);
	const used = new Set(scanExports(contents).symbols.map((symbol) => symbol.name));
	const named: string[] = [];
	for (const name of plan.named ?? []) {
		if (existing.has(name)) continue;
		let alias = name;
		if (used.has(alias)) {
			alias = `${name}Helper`;
			let suffix = 2;
			while (used.has(alias)) alias = `${name}Helper${suffix++}`;
		}
		used.add(alias);
		named.push(alias === name ? name : `${name} as ${alias}`);
	}
	return named;
}

/** Recognize existing imported names even when their SDK binding is qualified. */
function helperImports(contents: string, path: string): Set<string> {
	const source = ts.createSourceFile('index.ts', contents, ts.ScriptTarget.Latest, true);
	const existing = new Set<string>();
	for (const node of source.statements) {
		if (
			!ts.isExportDeclaration(node) ||
			!node.moduleSpecifier ||
			!ts.isStringLiteral(node.moduleSpecifier) ||
			node.moduleSpecifier.text !== path ||
			!node.exportClause ||
			!ts.isNamedExports(node.exportClause)
		)
			continue;
		for (const item of node.exportClause.elements)
			existing.add((item.propertyName ?? item.name).text);
	}
	return existing;
}

function exportLines(plan: ExportPlan): string[] {
	const lines: string[] = [];

	if (plan.named?.length) {
		lines.push(`export { ${plan.named.join(', ')} } from '${plan.source}';`);
	}

	if (plan.types?.length) {
		lines.push(`export type { ${plan.types.join(', ')} } from '${plan.source}';`);
	}

	return lines;
}

export type { ExportPlan } from '../../../core/projects-sessions/exports';
