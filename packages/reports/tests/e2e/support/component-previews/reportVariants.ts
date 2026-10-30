import { explorerKitVariant } from './explorerKitVariants';
import { pluginVariant } from './pluginVariants';
import type { PreviewCases } from './shared';
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

/** Report component fixture variants stay isolated from the shared catalog router. */
export function reportVariantProps(id: string, props: PreviewCases[string], variant: string) {
	const kit = explorerKitVariant(id, props, variant) ?? pluginVariant(id, props, variant);
	if (kit) return kit;
	const activity = activityReportVariant(id, props, variant);
	if (activity) return activity;
	if (id === 'reports.component.provider-picker-cards')
		return providerPickerCardVariant(props, variant);
	if (id === 'reports.component.provider-picker') return providerPickerVariant(props, variant);
	if (id === 'reports.component.select') return selectVariant(props, variant);
	if (id === 'reports.component.filter-dialog') return filterDialogVariant(props, variant);
	if (id === 'reports.component.modal') return modalVariant(props, variant);
	if (id === 'reports.component.contract-example') return contractExampleVariant(props, variant);
	if (id === 'reports.component.contract-table') return contractTableVariant(props, variant);
	const explorer = explorerVariantProps(id, props, variant);
	if (explorer) return explorer;
	if (id === 'reports.component.entity-cases') return entityCasesVariant(props, variant);
	if (id === 'reports.component.entity-contract') return entityContractVariant(props, variant);
	if (id === 'reports.component.entity-examples') return entityExamplesVariant(props, variant);
	if (id === 'reports.component.entity-search') return entitySearchVariant(props, variant);
	if (id === 'reports.component.entity-search-results') return searchResultsVariant(props, variant);
	if (id === 'reports.component.usage-examples-usage-examples')
		return usageExamplesVariant(props, variant);
	if (id === 'reports.component.explorer-ui-explorer-module-card')
		return moduleCardVariant(props, variant);
	if (id === 'reports.component.source-viewer') {
		const viewer = extendedSourceViewerVariant(props, variant);
		if (viewer) return viewer;
	}
	if (id.startsWith('reports.component.source-')) return sourceVariant(props, id, variant);

	if (id === 'reports.component.audio-evidence') return audioEvidenceVariant(props, variant);

	if (id === 'reports.component.evidence-card') return evidenceCardVariant(props, variant);
	if (id === 'reports.component.evidence-grid') return evidenceGridVariant(props, variant);
	if (id === 'reports.component.evidence-provenance')
		return evidenceProvenanceVariant(props, variant);
	if (id === 'reports.component.evidence-viewer') return evidenceViewerVariant(props, variant);

	if (id === 'reports.component.recorded-value') return recordedValueVariant(props, variant);

	if (id === 'reports.component.image-zoom') return imageZoomVariant(props, variant);

	if (id === 'reports.component.browser-errors') return browserErrorsVariant(props, variant);

	if (id === 'reports.component.console-chat' || id === 'reports.component.floating-chat')
		return chatVariantProps(id, props, variant);

	if (id === 'reports.component.regression-proof') return regressionProofVariant(props, variant);
	return audioVariant(id, props, variant);
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
			`<div class="viewer-images"><figure><img src="${image}" alt="Synthetic order card evidence" /><figcaption>Recorded order card · desktop evidence</figcaption></figure></div>`
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
		return { ...props, items: [{ ...item, loop: 'component-capture', red: null }] };
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
