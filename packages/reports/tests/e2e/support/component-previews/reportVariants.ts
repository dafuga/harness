import { shellCatalogProps } from './shellCatalogProps';
import { explorerKitVariant } from './explorerKitVariants';
import { pluginVariant } from './pluginVariants';
import type { PreviewCases, PreviewProps } from './shared';
import { chatVariantProps } from './chatVariants';
import { image, text } from './shared';
import { sourceVariant } from './reportSourceVariants';

import { moduleCardVariant } from './reportModuleCardVariants';
import { entityCasesVariant } from './reportEntityCasesVariants';
import { entityExamplesVariant } from './reportEntityExamplesVariants';
import { entityContractVariant } from './reportEntityContractVariants';
import { searchResultsVariant } from './reportSearchResultsVariants';
import { entitySearchVariant } from './reportEntitySearchVariants';
import { contractExampleVariant } from './reportContractExampleVariants';
import { contractTableVariant } from './reportContractTableVariants';
import { explorerVariantProps } from './reportExplorerVariants';
import { usageExamplesVariant } from './usageExamplesVariants';

import { audioComparisonVariant } from './audioComparisonVariants';
import { audioEvidenceVariant } from './audioEvidenceVariants';
import { evidenceCardVariant } from './evidenceCardVariants';
import { evidenceGridVariant } from './evidenceGridVariants';
import { evidenceProvenanceVariant } from './evidenceProvenanceVariants';
import { evidenceViewerVariant } from './evidenceViewerVariants';
import { activityReportVariant } from './activityReportVariants';

import { recordedValueVariant } from './recordedValueVariants';

import { imageZoomVariant } from './imageZoomVariants';

import { providerPickerCardVariant } from './providerPickerCardVariants';
import { providerPickerVariant } from './providerPickerVariants';
import { browserErrorsVariant } from './browserErrorsVariants';
import { videoCatalogProps } from './videoCatalogVariants';

const primitiveVariants = new Map<
	string,
	(props: PreviewProps, variant: string) => PreviewProps | null
>([
	['reports.component.provider-picker-cards', providerPickerCardVariant],
	['reports.component.provider-picker', providerPickerVariant],
	['reports.component.select', selectVariant],
	['reports.component.filter-dialog', filterDialogVariant],
	['reports.component.modal', modalVariant],
	['reports.component.contract-example', contractExampleVariant],
	['reports.component.contract-table', contractTableVariant]
]);

const componentVariants = new Map<
	string,
	(props: PreviewProps, variant: string) => PreviewProps | null
>([
	['reports.component.entity-cases', entityCasesVariant],
	['reports.component.entity-contract', entityContractVariant],
	['reports.component.entity-examples', entityExamplesVariant],
	['reports.component.entity-search', entitySearchVariant],
	['reports.component.entity-search-results', searchResultsVariant],
	['reports.component.usage-examples-usage-examples', usageExamplesVariant],
	['reports.component.explorer-ui-explorer-module-card', moduleCardVariant],
	['reports.component.audio-evidence', audioEvidenceVariant],
	['reports.component.evidence-card', evidenceCardVariant],
	['reports.component.evidence-grid', evidenceGridVariant],
	['reports.component.evidence-provenance', evidenceProvenanceVariant],
	['reports.component.evidence-viewer', evidenceViewerVariant],
	['reports.component.recorded-value', recordedValueVariant],
	['reports.component.image-zoom', imageZoomVariant],
	['reports.component.browser-errors', browserErrorsVariant],
	['reports.component.regression-proof', regressionProofVariant]
]);

/** Report component fixture variants stay isolated from the shared catalog router. */
export function reportVariantProps(id: string, props: PreviewCases[string], variant: string) {
	const base = reportBaseVariant(id, props, variant);
	if (base) return base;
	const primitive = primitiveVariants.get(id);
	if (primitive) return primitive(props, variant);
	const explorer = explorerVariantProps(id, props, variant);
	if (explorer) return explorer;
	const variantFor = componentVariants.get(id);
	if (variantFor) return variantFor(props, variant);
	if (id.startsWith('reports.component.source-')) return sourcePreview(id, props, variant);
	if (id === 'reports.component.console-chat' || id === 'reports.component.floating-chat')
		return chatVariantProps(id, props, variant);

	return audioVariant(id, props, variant);
}

function reportBaseVariant(id: string, props: PreviewProps, variant: string) {
	return (
		videoCatalogProps(id, variant) ??
		shellCatalogProps(id, props, variant) ??
		explorerKitVariant(id, props, variant) ??
		pluginVariant(id, props, variant) ??
		activityReportVariant(id, props, variant)
	);
}

function sourcePreview(id: string, props: PreviewProps, variant: string) {
	if (id === 'reports.component.source-viewer') {
		const viewer = extendedSourceViewerVariant(props, variant);
		if (viewer) return viewer;
	}
	return sourceVariant(props, id, variant);
}

function audioVariant(id: string, props: PreviewCases[string], variant: string) {
	if (
		!['reports.component.audio-comparison', 'reports.component.audio-comparison-viewer'].includes(
			id
		)
	)
		return null;
	return audioComparisonVariant(props, variant, id);
}

function selectVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'open') return { ...props, expanded: true };
	if (variant === 'compact') return { ...props, compact: true };
	if (variant === 'display')
		return {
			...props,
			label: 'Branch',
			value: 'release/orders/final-approval',
			display: 'release/orders/final-approval',
			title: 'release/orders/final-approval',
			children: text(
				'<optgroup label="Branches"><option value="release/orders/final-approval">release/orders/final-approval</option><option value="main">main</option></optgroup>'
			)
		};
	return variant === 'disabled' ? { ...props, disabled: true } : props;
}

function filterDialogVariant(props: PreviewCases[string], variant: string) {
	return variant === 'active' ? { ...props, active: 3 } : props;
}

function modalVariant(props: PreviewCases[string], variant: string) {
	if (variant !== 'lightbox' && variant !== 'image') return props;
	return {
		...props,
		title: 'Order card evidence',
		variant,
		children: text(
			`<div class="viewer-images"><figure><img src="${image}" alt="Order card evidence" /><figcaption>Order A-1048 · Ready to ship</figcaption></figure></div>`
		)
	};
}

function extendedSourceViewerVariant(props: PreviewCases[string], variant: string) {
	const state = props.state as Record<string, unknown>;
	if (variant === 'loading-list')
		return {
			...props,
			state: { ...state, files: [], path: '', text: '', loading: true, error: '' }
		};
	if (variant === 'list-error')
		return {
			...props,
			state: {
				...state,
				files: [],
				path: '',
				text: '',
				loading: false,
				error: 'The archived source file list is unavailable.'
			}
		};
	return variant === 'empty-file' ? { ...props, state: { ...state, text: '' } } : null;
}

function regressionProofVariant(props: PreviewCases[string], variant: string) {
	const item = (props.items as Array<Record<string, unknown>>)[0];
	if (variant === 'empty') return { ...props, items: [] };
	if (variant === 'pending') return { ...props, items: [{ ...item, green: undefined }] };
	if (variant === 'capture-only')
		return { ...props, items: [{ ...item, loop: 'checkout-capture', red: null }] };
	if (variant === 'gap')
		return {
			...props,
			items: [
				{
					...item,
					loop: 'evidence-retention',
					gap: 'The original failure record was not retained with this revision.'
				}
			]
		};
	return variant === 'output-open' ? props : null;
}
