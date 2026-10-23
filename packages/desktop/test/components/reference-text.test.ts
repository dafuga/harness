import { render } from 'svelte/server';
import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import ReferenceText from '../../src/components/reference-text/ReferenceText.svelte';
import { createWorkspaceStore } from '../../src/lib/stores/workspace.svelte';
import type { CatalogEntity, ProjectSnapshot } from '../../src/models/Desktop.types';

/**
 * The shared renderer adds no element around the text: words are text nodes, markup is shown
 * as text, and a reference is a link whose name is the unit's own name, its icon hidden.
 */
const tip = 'a'.repeat(40);
const frame = {
	...{ id: 'app.shell.order-frame', category: 'layouts', kind: 'shell', title: 'Order frame' },
	planned: false
} as CatalogEntity;
function drawn(text: string, entity: CatalogEntity | null = null) {
	const workspace = createWorkspaceStore();
	workspace.snapshot = {
		project: { name: 'Alpha', root: '/alpha', id: 'local-alpha' },
		revision: { branch: 'main', commit: tip, tip, atTip: true },
		...{ branches: [], commits: [], entities: [frame], writable: true }
	} as ProjectSnapshot;
	workspace.entity = entity as never;
	return render(ReferenceText, { props: { text, workspace, entity } }).body.replace(
		/<!--.*?-->/gs,
		''
	);
}

test('a reference is one link holding a hidden icon and the unit name, and nothing wraps the text', () => {
	const body = drawn('In [[unit:app.shell.order-frame]], now.');
	expect(body).toMatch(
		/^In <a class="unit-reference[^"]*" href="\/projects\/local-alpha\/harness\/branch\/main\/shells\/app\.shell\.order-frame"[^>]*><svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg>Order frame<\/a>, now\.$/s
	);
});

test('markup and an overlong unresolved token are shown exactly as text', () => {
	const token = `[[unit:app.function.${'x'.repeat(180)}]]`;
	const body = drawn(`<script>alert(1)</script> ${token}`);
	expect(body).toBe(`&lt;script>alert(1)&lt;/script> ${token}`);
});

test('the entity in view is a link before the catalog lists it', () => {
	const draft = { ...frame, id: 'app.page.refunds', category: 'pages', title: 'Refund list' };
	expect(drawn('Plan [[unit:app.page.refunds]]', draft as CatalogEntity)).toContain(
		'pages/app.page.refunds"'
	);
	expect(drawn('Plan [[unit:app.page.refunds]]')).toBe('Plan [[unit:app.page.refunds]]');
});
