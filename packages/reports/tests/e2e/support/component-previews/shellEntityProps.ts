import type { PreviewCases } from './shared';
import { text } from './shared';
import * as d from './explorerData';
import { artifactProps, audioProps, behaviorProps, screenProps } from './shellEntityEvidenceProps';

/** Branch fixtures keep the original sealed evidence and change only the declared caller state. */
const handlers: Record<
	string,
	(props: PreviewCases[string], variant: string) => PreviewCases[string]
> = {
	artifact: artifactProps,
	audio: audioProps,
	behavior: behaviorProps,
	screens: screenProps,
	details: detailsProps,
	link: linkProps,
	missing: missingProps,
	relations: relationsProps,
	history: historyProps,
	source: sourceProps
};
export function shellEntityProps(id: string, props: PreviewCases[string], variant: string) {
	const key = id.replace('reports.component.harness-entity-', '');
	return handlers[key]?.(props, variant) ?? null;
}

function detailsProps(props: PreviewCases[string], variant: string) {
	return {
		...props,
		tab: variant === 'summary' ? 'summary' : selectedTab(variant),
		record: variant === 'unmeasured' ? null : props.record
	};
}

function linkProps(props: PreviewCases[string], variant: string) {
	return {
		...props,
		label: variant === 'labelled' ? 'Open the order list at this revision' : undefined,
		children:
			variant === 'long'
				? text(
						'<span>OrderList with a deliberately long name for the selected repository revision</span>'
					)
				: props.children
	};
}

function missingProps(props: PreviewCases[string], variant: string) {
	return {
		...props,
		action: variant === 'custom-action' ? 'Open the component collection' : undefined,
		message:
			variant === 'long'
				? 'The component does not exist at this selected revision. '.repeat(8)
				: props.message
	};
}

function relationsProps(props: PreviewCases[string], variant: string) {
	const empty = Object.fromEntries(
		Object.keys(d.reading.relations(d.entity.id)).map((key) => [key, []])
	);
	return {
		...props,
		relations: ['empty', 'removed'].includes(variant) ? empty : props.relations,
		removed: variant === 'removed',
		show: ['empty', 'removed'].includes(variant) ? 'both' : variant
	};
}

function sourceProps(props: PreviewCases[string], variant: string) {
	if (variant === 'linked') return { ...props, repository: 'https://github.com/example/orders' };
	const unit = d.entity.unit;
	let source = unit.owns.source;
	if (variant === 'empty') source = [];
	if (variant === 'long')
		source = [
			'src/components/orders/OrderListWithAnIntentionallyLongCommittedSourceFileName.svelte'
		];
	return {
		...props,
		unit: {
			...unit,
			owns: { ...unit.owns, source },
			testFiles:
				variant === 'tests'
					? ['test/orders/OrderList.test.ts', 'tests/e2e/orders.spec.ts'].map((path) => ({
							path,
							media: null,
							gap: 'Synthetic archived file list'
						}))
					: []
		}
	};
}

const historyNotes = [
	'Keeps the chosen source revision and comparison parent visible while browsing order changes, so links continue to open the same committed files.',
	'Displays captured behavior alongside source size, complexity and latency, retaining the original profile and evidence instead of substituting newer results.'
];

function historyProps(props: PreviewCases[string], variant: string) {
	if (variant === 'empty') return { ...props, rows: [] };
	const rows = d.reading.history(d.entity.id);
	if (['unread', 'reading', 'unavailable'].includes(variant))
		return {
			...props,
			rows: rows.map((row) => ({
				...row,
				standing: 'unknown',
				gap: 'This revision has no recorded change index.'
			})),
			known: [],
			client: {
				revision: () =>
					variant === 'unavailable'
						? Promise.reject(new Error('Revision unavailable'))
						: new Promise(() => {})
			}
		};
	return {
		...props,
		known: [d.shown.head, d.shown.parent].map((head) => ({
			...head,
			explanations: head.explanations.flatMap((reason) =>
				historyNotes.map((behavior) => ({
					...reason,
					unit: d.entity.id,
					symbol: 'OrderList',
					behavior
				}))
			)
		}))
	};
}

function selectedTab(variant: string) {
	return variant === 'unmeasured' ? 'measurements' : variant;
}
