import type { Page, Locator } from '@playwright/test';
import type { browserErrorCollector } from '../../../../../../test/support/browserTest';
import type { catalogCases, catalogViewports } from './catalogUnits';
import type { capturePreview } from './previewPage';

export type CatalogErrors = ReturnType<typeof browserErrorCollector>;
export type CatalogUnit = (typeof catalogCases)[number]['unit'];
export type CatalogViewport = (typeof catalogViewports)[number];
export type CatalogCapture = Awaited<ReturnType<typeof capturePreview>> | undefined;

export interface CatalogCheckContext {
	page: Page;
	component: Locator;
	unit: CatalogUnit;
	variant: string;
	viewport: CatalogViewport;
	capture?: CatalogCapture;
}
