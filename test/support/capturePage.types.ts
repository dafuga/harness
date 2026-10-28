import type { Page, TestInfo } from '@playwright/test';
import type { MatchScreenshot } from '../../tests/e2e/support/browserTest.types';
export interface CaptureContext { page: Page; info: TestInfo; matchScreenshot: MatchScreenshot; state: string; viewport: { id: string; width: number; height: number }; }
