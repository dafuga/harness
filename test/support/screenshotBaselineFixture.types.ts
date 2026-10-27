export interface ScreenshotFixtureOptions {
	bindingCase?: string;
	corruptImage?: boolean;
	provenance?: 'fixture' | 'actual-capture';
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
	caseBytes: Buffer;
	log: Buffer;
	options: ScreenshotFixtureOptions;
}
