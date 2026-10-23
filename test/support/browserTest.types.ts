import type { TestInfo } from '@playwright/test';

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
