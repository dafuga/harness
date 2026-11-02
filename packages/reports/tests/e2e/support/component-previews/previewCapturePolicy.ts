import type { Page } from '@playwright/test';

export function captureClip(
	page: Page,
	bounds: { x: number; y: number; width: number; height: number },
	nativeOpen: boolean
) {
	if (!nativeOpen) return bounds;
	const height = page.viewportSize()?.height ?? bounds.height;
	return { ...bounds, height: Math.max(1, Math.min(bounds.height, height - bounds.y)) };
}

const nativePopups: Record<string, string[]> = {
	'reports.component.evidence-grid': ['status-open'],

	'reports.component.explorer-ui-explorer-platforms': ['status-options-open'],
	'reports.component.explorer-ui-explorer-translations-screen': ['language-open']
};

export function usesNativePopup(id: string, variant: string) {
	return nativePopups[id]?.includes(variant) ?? false;
}

export function previewCaptureNote(id: string, variant: string) {
	return id === 'reports.component.evidence-grid' && ['image-open', 'audio-open'].includes(variant)
		? 'Rendered dialog bounds without preview-only canvas. Synthetic representative inputs; real backend and native-device behavior are not reproduced.'
		: 'Rendered component bounds with an 8px edge allowance, excluding preview-only headings and canvas. Synthetic representative inputs; real backend and native-device behavior are not reproduced.';
}
