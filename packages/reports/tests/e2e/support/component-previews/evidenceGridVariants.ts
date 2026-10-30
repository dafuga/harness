import type { PreviewCases } from './shared';
import { noop } from './shared';
import type { Evidence, Status } from '../../../../src/models/reports-media/Report.types';

/** Supply empty, screenshot-only and upload-enabled gallery inputs. */
export function evidenceGridVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'no-items') return { ...props, items: [] };
	const status = variant.slice('status-'.length) as Status;
	if (['failed', 'blocked', 'skipped', 'not-proven'].includes(status))
		return {
			...props,
			items: (props.items as Evidence[]).map((item, index) =>
				index === 0 ? { ...item, status } : item
			)
		};
	if (variant === 'image-open')
		return {
			...props,
			items: (props.items as Array<{ provenance?: unknown }>).map((item, index) =>
				index === 0 ? { ...item, provenance: undefined } : item
			)
		};
	if (variant === 'screenshot-only')
		return {
			...props,
			items: (props.items as Array<{ mediaType?: string }>).filter(
				(item) => item.mediaType !== 'audio'
			)
		};
	if (['uploads', 'upload-comparison-open', 'upload-audio-open'].includes(variant))
		return { ...props, reportId: 'preview-report', onUploaded: noop, idPrefix: 'upload-' };
	return props;
}
