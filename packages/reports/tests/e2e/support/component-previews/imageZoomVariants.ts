import type { PreviewCases } from './shared';

/** Native image loading, zoom limits and interaction states. */
export const imageZoomStates = [
	'loading',
	'error',
	'actual',
	'zoomed',
	'zoom-out',
	'maximum',
	'panned',
	'focused',
	'dragging'
];

/** Use a held response or malformed image for the two unresolved image states. */
export function imageZoomVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'loading') return { ...props, src: '/media/image-zoom-loading.svg' };
	if (variant === 'error') return { ...props, src: '/media/preview-invalid-image.svg' };
	return props;
}
