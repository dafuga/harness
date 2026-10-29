import type { PreviewCases } from './shared';
import { noop } from './shared';
import { baselineNarration, releaseNarration } from './reportData';

/** Report component fixture variants stay isolated from the shared catalog router. */
export function reportVariantProps(id: string, props: PreviewCases[string], variant: string) {
	if (id === 'reports.component.filter-dialog') return filterDialogVariant(props, variant);
	if (id === 'reports.component.audio-evidence') return audioEvidenceVariant(props, variant);
	if (id === 'reports.component.audio-upload-files') return audioUploadFilesVariant(props, variant);
	if (id === 'reports.component.evidence-card') return evidenceCardVariant(props, variant);
	if (id === 'reports.component.evidence-grid') return evidenceGridVariant(props, variant);
	if (id === 'reports.component.evidence-provenance') return evidenceProvenanceVariant(props, variant);
	if (!['reports.component.audio-comparison', 'reports.component.audio-comparison-viewer'].includes(id))
		return null;
	if (variant === 'before' || variant === 'after') return props;
	if (variant !== 'unavailable') return null;
	const before = props.before as Record<string, unknown>;
	return {
		...props,
		before: {
			...before,
			file: '',
			missing: true,
			note: 'The original recording was not retained with this evidence.'
		}
	};
}

function filterDialogVariant(props: PreviewCases[string], variant: string) {
	return variant === 'active' ? { ...props, active: 3 } : props;
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
