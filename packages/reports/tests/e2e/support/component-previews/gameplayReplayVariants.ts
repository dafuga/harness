import type { PreviewCases } from './shared';
import type { Evidence, Report } from '../../../../src/models/reports-media/Report.types';

/** Each replay branch uses the same game run, with only the selected condition changed. */
export function gameplayReplayVariant(props: PreviewCases[string], variant: string) {
	const report = props.report as Report;
	if (variant === 'live-empty')
		return { ...props, report: { ...report, state: 'active', status: 'running', evidence: [] } };
	if (variant === 'interrupted')
		return { ...props, report: { ...report, state: 'finalized', status: 'interrupted' } };
	if (variant === 'live' || variant === 'waiting-live')
		return { ...props, report: { ...report, state: 'active', status: 'running' } };
	if (variant === 'single-frame')
		return { ...props, report: { ...report, evidence: report.evidence.slice(0, 1) } };
	if (['loading', 'image-error', 'last-image-error', 'skipped'].includes(variant)) {
		const file =
			variant === 'loading' ? '/media/gameplay-loading.svg' : '/media/preview-invalid-image.svg';
		const evidence: Evidence[] = report.evidence.map((item, index) =>
			index === (variant === 'last-image-error' ? report.evidence.length - 1 : 0)
				? { ...item, file, mimeType: 'image/svg+xml' }
				: item
		);
		return { ...props, report: { ...report, evidence } };
	}
	if (variant === 'nonportable' || variant === 'download-preparing')
		return { ...props, portable: false };
	return [
		'playing',
		'last-frame',
		'ended',
		'fullscreen',
		'speed-open',
		'scene-open',
		'scene-selected',
		'speed-2x'
	].includes(variant)
		? props
		: null;
}
