import type {
	Locator,
	Page,
	PageAssertionsToHaveScreenshotOptions,
	TestInfo
} from '@playwright/test';

export interface BrowserError {
	type: 'console' | 'pageerror';
	message: string;
	page: string;
	source?: string;
	line?: number;
	column?: number;
	stack?: string;
}

export interface ExpectedBrowserError {
	type: BrowserError['type'];
	message: string;
	reason: string;
	source?: string;
}

export type DiagnosticInfo = Pick<TestInfo, 'attach'> &
	Partial<Pick<TestInfo, 'titlePath' | 'file' | 'config' | 'project' | 'retry'>>;

export type ScreenshotTarget = Page | Locator;
export type ScreenshotName = string | ReadonlyArray<string>;
export type MatchScreenshotOptions = PageAssertionsToHaveScreenshotOptions;
export type MatchScreenshot = (
	target: ScreenshotTarget,
	name: ScreenshotName,
	options?: MatchScreenshotOptions
) => Promise<void>;
