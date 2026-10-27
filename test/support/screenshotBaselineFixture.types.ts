export interface ScreenshotFixtureOptions {
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
		status: 'failed' | 'skipped';
		retry: number;
	};
	sibling?: { path: string; note: string; outcome?: ScreenshotFixtureSeed['outcome'] };
	caseBytes: Buffer;
	log: Buffer;
	options: ScreenshotFixtureOptions;
}
