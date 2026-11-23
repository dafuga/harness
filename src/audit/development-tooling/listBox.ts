// @harness-uid u_t4ewx7hbqc
import { atomicSyntax } from '../../templates/development-tooling/atomicSyntax.js';
import type { AuditFile } from './adapters/types';
import type { AuditFinding } from './types';

const selectElement = /^(?:hx-)?select$/;
const formElement = /^(?:hx-)?form$/;
const dialogComponent = /(?:Modal|Dialog)$/;
const dialogElements = new Set(['dialog', 'hx-dialog']);
const listBoxAttributes = new Set(['size', 'multiple']);
const skipped = new Set(['parent', 'metadata', 'expression', 'attributes']);

/**
 * A picker is a list of rows from the shared list components, never a native list box
 * (`select[size]` or `multiple`), which brings the system highlight. A form dialog may hold one.
 */
export function auditListBox(file: AuditFile): AuditFinding[] {
	if (file.extension !== '.svelte') return [];
	let tree;
	try {
		tree = atomicSyntax(file.contents).tree;
	} catch {
		return [];
	}
	const count = countListBoxes(tree.fragment, false);
	return Array.from({ length: count }, () => ({
		path: file.relativePath,
		rule: 'native-list-box',
		message:
			'Use the shared list rows for a picker, not a native list box (select[size] or multiple); only a form dialog may hold one.'
	}));
}

/** Counts native list boxes outside a dialog that holds a form. */
function countListBoxes(node: unknown, inFormDialog: boolean): number {
	if (!node || typeof node !== 'object') return 0;
	if (Array.isArray(node))
		return node.reduce<number>((total, child) => total + countListBoxes(child, inFormDialog), 0);
	const record = node as Record<string, unknown>;
	const own = !inFormDialog && isListBox(record) ? 1 : 0;
	const holdsForm = inFormDialog || (isDialog(record) && containsForm(record));
	return (
		own +
		childrenOf(record).reduce<number>((total, child) => total + countListBoxes(child, holdsForm), 0)
	);
}

function isListBox(node: Record<string, unknown>): boolean {
	if (!node.type || !selectElement.test(String(node.name ?? ''))) return false;
	const attributes = (node.attributes ?? []) as Array<Record<string, unknown>>;
	return attributes.some((attribute) => listBoxAttributes.has(String(attribute.name)));
}

function isDialog(node: Record<string, unknown>): boolean {
	const name = String(node.name ?? '');
	if (node.type === 'Component') return dialogComponent.test(name);
	return dialogElements.has(name);
}

/** Whether a dialog's markup contains a form element, which makes it a form dialog. */
function containsForm(node: unknown): boolean {
	if (!node || typeof node !== 'object') return false;
	if (Array.isArray(node)) return node.some(containsForm);
	const record = node as Record<string, unknown>;
	if (record.type && formElement.test(String(record.name ?? ''))) return true;
	return childrenOf(record).some(containsForm);
}

/** Child values of a markup node, skipping script, attribute and expression subtrees. */
function childrenOf(record: Record<string, unknown>): unknown[] {
	return Object.entries(record)
		.filter(([key]) => !skipped.has(key))
		.map(([, child]) => child);
}
