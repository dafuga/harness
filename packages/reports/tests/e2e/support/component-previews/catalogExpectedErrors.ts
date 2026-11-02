import * as picker from './translationsPreviewAssertions';
import type { Page } from '@playwright/test';
import type { CatalogErrors, CatalogViewport } from './catalogChecks.types';

export function catalogExpectedErrors(
	page: Page,
	browserErrors: CatalogErrors,
	id: string,
	{ variant, viewport }: { variant: string; viewport: CatalogViewport }
) {
	picker.expectUploadErrors(id, variant, browserErrors);
	const projectErrors: string[] = [];
	if (id === 'reports.component.console-chat' && variant === 'connection-error')
		browserErrors.expectError({
			type: 'console',
			message:
				'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
			reason: 'The console connection-error fixture deliberately refuses the connection.'
		});
	if (id === 'reports.component.provider-picker' && variant === 'connection-error') {
		// Desktop profiles six remounts, each exercising the same refused connection.
		for (let attempt = 0; attempt < (viewport.id === 'desktop' ? 7 : 1); attempt++)
			browserErrors.expectError({
				type: 'console',
				message:
					'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
				reason: 'The picker connection-error fixture deliberately refuses the connection.'
			});
	}
	if (id === 'desktop.component.project-agent') {
		page.on('pageerror', (error) => projectErrors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') projectErrors.push(message.text());
		});
	}
	return projectErrors;
}
