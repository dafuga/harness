import type { Locator } from '@playwright/test';

export type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;
