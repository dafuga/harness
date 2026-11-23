// @harness-uid u_jjuxchfdnr
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { atomicSyntax } from '../../templates/development-tooling/atomicSyntax.js';
import type { AuditFile } from './adapters/types';
import type { AuditFinding } from './types';

const overviewMarker = /<!--\s*@harness-view\s+overview\s*-->/;
const dialogComponent = /(?:Modal|Dialog)$/;
const dialogElements = new Set(['dialog', 'hx-dialog']);
const formElement = /^(?:hx-)?(?:form|input(?:-[a-z-]+)?|textarea|select)$/;
const formSource = /<(?:hx-)?form\b/;
const relativeImport = /import\s+([A-Z]\w*)\s+from\s+['"](\.{1,2}\/[^'"]+\.svelte)['"]/g;

/**
 * Overview screens (marked `<!-- @harness-view overview -->`) show one main piece: they ask for no
 * input outside a dialog and offer at most one primary button.
 */
export function auditOverviewLayout(file: AuditFile): AuditFinding[] {
	if (file.extension !== '.svelte' || !overviewMarker.test(file.contents)) return [];
	let tree;
	try {
		tree = atomicSyntax(file.contents).tree;
	} catch {
		return [];
	}
	const forms = formComponents(file);
	const findings: AuditFinding[] = [];
	let primaries = 0;
	visitOutsideDialogs(tree.fragment, (node) => {
		const name = String(node.name ?? '');
		if (formElement.test(name) || (node.type === 'Component' && forms.has(name)))
			findings.push({
				path: file.relativePath,
				rule: 'overview-inline-form',
				message: `Open ${name} in a dialog or on its own page; an overview screen shows no inline form.`
			});
		if (/^(?:hx-)?button$/.test(name) && hasPrimaryClass(node)) primaries++;
	});
	if (primaries > 1)
		findings.push({
			path: file.relativePath,
			rule: 'overview-single-primary',
			message: `An overview screen has one primary button; found ${primaries}.`
		});
	return findings;
}

/** Relative Svelte imports whose own markup renders a form. */
function formComponents(file: AuditFile): Set<string> {
	const names = new Set<string>();
	for (const [, name, path] of file.contents.matchAll(relativeImport)) {
		const source = resolve(dirname(file.absolutePath), path);
		if (existsSync(source) && formSource.test(readFileSync(source, 'utf8'))) names.add(name);
	}
	return names;
}

const skipped = new Set(['parent', 'metadata', 'expression', 'attributes']);

/** Visits markup nodes without entering a dialog: a dialog may hold a form. */
function visitOutsideDialogs(node: unknown, visit: (node: Record<string, unknown>) => void): void {
	if (!node || typeof node !== 'object') return;
	if (Array.isArray(node)) {
		for (const child of node) visitOutsideDialogs(child, visit);
		return;
	}
	const record = node as Record<string, unknown>;
	if (record.type) {
		if (isDialog(record)) return;
		visit(record);
	}
	for (const [key, child] of Object.entries(record))
		if (!skipped.has(key)) visitOutsideDialogs(child, visit);
}

function isDialog(node: Record<string, unknown>): boolean {
	const name = String(node.name ?? '');
	if (node.type === 'Component') return dialogComponent.test(name);
	return dialogElements.has(name);
}

function hasPrimaryClass(node: Record<string, unknown>): boolean {
	const attributes = (node.attributes ?? []) as Array<Record<string, unknown>>;
	return attributes.some((attribute) => {
		if (attribute.name !== 'class' || !Array.isArray(attribute.value)) return false;
		return attribute.value.some(
			(part: { type?: string; data?: string }) =>
				part.type === 'Text' && /(?:^|\s)primary(?:\s|$)/.test(part.data ?? '')
		);
	});
}
