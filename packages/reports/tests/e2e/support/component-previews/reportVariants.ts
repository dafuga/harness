import type { PreviewCases } from './shared';
import { chatVariantProps } from './chatVariants';
import { image, noop, text } from './shared';
import { baselineNarration, releaseNarration } from './reportData';
import { sourceVariant } from './reportSourceVariants';
import { moduleCardVariant } from './reportModuleCardVariants';
import { entityCasesVariant } from './reportEntityCasesVariants';
import { replayControlsVariant } from './replayControlsVariants';
import { audioComparisonVariant } from './audioComparisonVariants';
import { evidenceViewerVariant } from './evidenceViewerVariants';

/** Report component fixture variants stay isolated from the shared catalog router. */
export function reportVariantProps(id: string, props: PreviewCases[string], variant: string) {
	if (id === 'reports.component.select') return selectVariant(props, variant);
	if (id === 'reports.component.filter-dialog') return filterDialogVariant(props, variant);
	if (id === 'reports.component.modal') return modalVariant(props, variant);
	if (id === 'reports.component.entity-cases') return entityCasesVariant(props, variant);
	if (id === 'reports.component.explorer-ui-explorer-module-card')
		return moduleCardVariant(props, variant);
	if (id.startsWith('reports.component.source-')) return sourceVariant(props, id, variant);
	if (id === 'reports.component.audio-evidence') return audioEvidenceVariant(props, variant);
	if (id === 'reports.component.audio-upload-files') return audioUploadFilesVariant(props, variant);
	if (id === 'reports.component.evidence-card') return evidenceCardVariant(props, variant);
	if (id === 'reports.component.evidence-grid') return evidenceGridVariant(props, variant);
	if (id === 'reports.component.evidence-provenance')
		return evidenceProvenanceVariant(props, variant);
	if (id === 'reports.component.evidence-viewer') return evidenceViewerVariant(props, variant);
	if (id === 'reports.component.console-chat' || id === 'reports.component.floating-chat')
		return chatVariantProps(id, props, variant);
	if (id === 'reports.component.gameplay-replay') return gameplayReplayVariant(props, variant);
	if (id === 'reports.component.replay-controls') return replayControlsVariant(props, variant);
	if (id === 'reports.component.regression-proof') return regressionProofVariant(props, variant);
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
			display: 'release/orders/final-approval',
			title: 'release/orders/final-approval'
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

function audioUploadFilesVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'comparison') return { ...props, mode: 'comparison' };
	return variant === 'uploading' ? { ...props, mode: 'comparison', uploading: true } : null;
}

function evidenceCardVariant(props: PreviewCases[string], variant: string) {
	const item = props.item as Record<string, unknown>;
	if (variant === 'missing')
		return {
			...props,
			item: { ...item, missing: true, note: 'The recorded screenshot could not be restored.' }
		};
	if (variant === 'compact')
		return {
			...props,
			compact: true,
			item: {
				...item,
				provenance: [
					{ label: 'Viewport', value: 'Desktop' },
					{ label: 'Source', value: 'Browser capture' }
				]
			}
		};
	return variant === 'paired-audio'
		? { ...props, item: releaseNarration, before: baselineNarration }
		: null;
}

function evidenceGridVariant(props: PreviewCases[string], variant: string) {
	return variant === 'uploads'
		? { ...props, reportId: 'preview-report', onUploaded: noop, idPrefix: 'upload-' }
		: props;
}

function evidenceProvenanceVariant(props: PreviewCases[string], variant: string) {
	if (variant !== 'extended') return null;
	const item = props.item as Record<string, unknown>;
	return {
		...props,
		item: {
			...item,
			provenance: [
				{ label: 'Viewport', value: 'Desktop' },
				{ label: 'Browser', value: 'Chromium 142' },
				{ label: 'Capture', value: 'Playwright catalog fixture' },
				{ label: 'Revision', value: 'b8e942614a57' }
			]
		}
	};
}

function gameplayReplayVariant(props: PreviewCases[string], variant: string) {
	const report = props.report as Record<string, unknown>;
	if (variant === 'live-empty')
		return { ...props, report: { ...report, state: 'active', status: 'running', evidence: [] } };
	return variant === 'interrupted'
		? { ...props, report: { ...report, state: 'finalized', status: 'interrupted' } }
		: null;
}

function regressionProofVariant(props: PreviewCases[string], variant: string) {
	const item = (props.items as Array<Record<string, unknown>>)[0];
	if (variant === 'pending') return { ...props, items: [{ ...item, green: undefined }] };
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

function audioEvidenceVariant(props: PreviewCases[string], variant: string) {
	const item = props.item as Record<string, unknown>;
	if (variant === 'notes')
		return {
			...props,
			item: {
				...item,
				transcript: undefined,
				note: 'Timing and diction were reviewed before approval.'
			}
		};
	if (variant !== 'unavailable') return null;
	return {
		...props,
		item: {
			...item,
			file: '',
			missing: true,
			note: 'The original recording was not retained with this evidence.'
		}
	};
}
