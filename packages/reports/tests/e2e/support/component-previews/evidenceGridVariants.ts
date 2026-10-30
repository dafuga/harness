import type { PreviewCases } from './shared';
import { noop } from './shared';

/** Supply empty, screenshot-only and upload-enabled gallery inputs. */
export function evidenceGridVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'no-items') return { ...props, items: [] };
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
