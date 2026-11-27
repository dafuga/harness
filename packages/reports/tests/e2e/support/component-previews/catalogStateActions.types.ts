import type { Locator } from '@playwright/test';

export type CatalogStateAction = (component: Locator) => Promise<void>;
export type CatalogPreparation = (component: Locator, variant: string) => Promise<void>;
