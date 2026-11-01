import EvidenceViewer from '../../../src/components/verification-evidence/EvidenceViewer.svelte';
import type { Evidence } from '../../../src/models/reports-media/Report.types';
import { measureWorkload } from '../../../../../test/support/measureWorkload';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import ComparePanes from '../../../src/components/shared-primitives/ComparePanes.svelte';
import { comparisonPanes } from '../../../src/helpers/verification-evidence/comparisonPanes';
import type { ComparisonPane } from '../../../src/helpers/verification-evidence/comparisonPanes.types';

const content = createRawSnippet<[ComparisonPane<unknown>]>((pane) => ({
	render: () => `<p>${pane().value}</p>`
}));
test('comparison labels and metadata come from the same side in every view', async () => {
	assertComparisonLabels();
	await measureWorkload(
		'reports.component.evidence-viewer',
		'side-bound-viewer-provenance',
		assertViewerSides
	);
});

function assertComparisonLabels() {
	const panes = comparisonPanes(
		{ commit: 'a12bc34def', value: 'Build: orders-parent' },
		{ commit: 'b56de78abc', value: 'Build: orders-selected' }
	);
	for (const side of ['before', 'after'] as const) {
		const body = render(ComparePanes, { props: { panes, visible: side, children: content } }).body;
		const own =
			side === 'before'
				? ['Before · a12bc34', 'Build: orders-parent']
				: ['After · b56de78', 'Build: orders-selected'];
		const other = side === 'before' ? 'Build: orders-selected' : 'Build: orders-parent';
		for (const text of own) expect(body).toContain(text);
		expect(body).not.toContain(other);
	}
	const gap = render(ComparePanes, {
		props: {
			panes: comparisonPanes(null, { commit: 'b56de78abc', gap: 'No selected capture.' }),
			children: content
		}
	}).body;
	expect(gap).toContain('No selected capture.');
	expect(gap).not.toContain('Build: orders-parent');
}

function invoiceEvidence() {
	const before: Evidence = {
		id: 'invoice-before',
		title: 'Invoice before approval',
		category: 'Invoices',
		file: 'invoice-before.svg',
		status: 'passed',
		phase: 'before',
		comparison: 'invoice-approval',
		viewport: 'desktop',
		source: 'a12bc34deffedcba123456789012345678901234567',
		provenance: [{ label: 'Build', value: 'invoices-parent' }]
	};
	const after: Evidence = {
		...before,
		id: 'invoice-after',
		title: 'Invoice approved',
		file: 'invoice-after.svg',
		phase: 'after',
		source: 'b56de78abc01234567890123456789012345678901',
		provenance: [{ label: 'Build', value: 'invoices-selected' }]
	};
	return [before, after] as const;
}

function observeItems(items: Evidence[]) {
	let iteratorReads = 0;
	Object.defineProperty(items, Symbol.iterator, {
		value: function* () {
			iteratorReads++;
			for (let index = 0; index < items.length; index++) yield items[index];
		}
	});
	let speciesReads = 0;
	Object.defineProperty(items, 'constructor', {
		value: {
			get [Symbol.species]() {
				speciesReads++;
				return Array;
			}
		}
	});
	return { iterator: () => iteratorReads, species: () => speciesReads };
}

function viewer(items: Evidence[], selected: Evidence) {
	return render(EvidenceViewer, {
		props: {
			items,
			selected,
			navigableItems: [],
			assetBase: '/media/',
			onclose: () => {},
			onselect: () => {}
		}
	}).body;
}

function assertViewerSides() {
	const [before, after] = invoiceEvidence();
	const items = [before, after];
	const reads = observeItems(items);
	const paired = viewer(items, before);
	expect(paired).toContain('invoices-selected');
	expect(paired).not.toContain('invoices-parent');
	expect(paired).toContain('invoice-after.svg');
	expect(reads.species()).toBeGreaterThan(0);
	expect(reads.iterator()).toBeGreaterThan(0);
	const unreadable = [before, after];
	const iteratorError = new Error('Unreadable evidence iterator');
	Object.defineProperty(unreadable, Symbol.iterator, {
		value: () => {
			throw iteratorError;
		}
	});
	expect(() => viewer(unreadable, after)).toThrow(iteratorError);
	Object.defineProperty(before, 'provenance', {
		get() {
			throw new Error('Invisible parent provenance must not be read');
		},
		configurable: true
	});
	expect(viewer(items, after)).toContain('invoices-selected');
	Object.defineProperty(before, 'provenance', {
		value: [{ label: 'Build', value: 'invoices-parent' }],
		configurable: true
	});
	const missing = viewer([before], before);
	expect(missing).toContain('No after screenshot is recorded for this state.');
	expect(missing).not.toContain('invoice-before.svg');
	expect(missing).not.toContain('invoices-parent');
}
