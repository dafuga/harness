export interface ScreenshotFixtureOptions {
	attempts?:
		| 'bound'
		| 'legacy'
		| 'missing'
		| 'duplicate'
		| 'unreported'
		| 'duplicate-outcome'
		| 'skipped';
	bindingCase?: string;
	corruptImage?: boolean;
	duplicate?: boolean;
	provenance?: 'fixture' | 'actual-capture';
	sibling?: boolean;
	skipped?: boolean;
	snapshotFailed?: boolean;
	wrongBuild?: boolean;
}

export interface ScreenshotFixtureSeed {
	commit: string;
	tree: string;
	image: Buffer;
	sha256: string;
	buildId: string;
	note: string;
	path: string;
	outcome: {
		file: string;
		title: string;
		revision: string;
		status: 'failed' | 'skipped' | 'passed';
		retry: number;
	};
	sibling?: {
		path: string;
		note: string;
		outcome?: ScreenshotFixtureSeed['outcome'];
		omitCapture?: boolean;
	};
	caseBytes: Buffer;
	log: Buffer;
	options: ScreenshotFixtureOptions;
}
