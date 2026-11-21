import type { Locator } from '@playwright/test';

export type CatalogStateAction = (component: Locator) => Promise<void>;
