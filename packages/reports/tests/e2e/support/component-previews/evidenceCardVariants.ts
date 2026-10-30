import type { PreviewCases } from './shared';
import { audio, baselineNarration, releaseNarration } from './reportData';

const statuses = ['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'];

/** Screenshot, unavailable, compact and audio forms of one evidence card. */
export function evidenceCardVariant(props: PreviewCases[string], variant: string) {
	const item = props.item as Record<string, unknown>;
	if (variant === 'paired-audio')
		return { ...props, item: releaseNarration, before: baselineNarration };
	if (variant === 'single-audio') return { ...props, item: audio };
	if (['compact', 'compact-closed'].includes(variant)) return { ...props, compact: true };
	if (variant === 'missing')
		return {
			...props,
			item: { ...item, missing: true, note: 'The recorded screenshot was not retained.' }
		};
	if (variant === 'image-error')
		return {
			...props,
			item: {
				...item,
				file: 'preview-invalid-image.svg',
				note: 'The screenshot could not be decoded.'
			}
		};
	if (variant === 'minimal')
		return {
			...props,
			item: { ...item, viewport: undefined, capturedAt: undefined, provenance: [] }
		};
	return statuses.includes(variant) ? { ...props, item: { ...item, status: variant } } : null;
}
