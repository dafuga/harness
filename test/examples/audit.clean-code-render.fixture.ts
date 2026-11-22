import type {
	CleanCodeReport,
	FileReview
} from '../../src/audit/development-tooling/cleanCodeTypes';

export const covered = 'src/audit/development-tooling/cleanCodeRender.ts';

export const meta = {
	rubricVersion: 'clean-code-v1',
	requestedModel: 'jev-1.13.0',
	minConfidence: 0.85
};

export const noUsage = { input_tokens: 0, output_tokens: 0 };

const coverageOf = { selectedFiles: [covered], excludedPaths: [], unsupportedFiles: [] };

export function report(
	mode: CleanCodeReport['mode'],
	status: CleanCodeReport['status'],
	files: FileReview[],
	total: CleanCodeReport['usage']
): CleanCodeReport {
	return { mode, status, ...meta, coverage: coverageOf, files, usage: total };
}

export const dryRunReport: CleanCodeReport = {
	...report('advisory', 'dry-run', [], noUsage),
	coverage: {
		selectedFiles: ['src/audit/cleanCodeRender.ts', covered],
		excludedPaths: [{ path: 'dist/', reason: 'Artifact directory or symlink' }],
		unsupportedFiles: ['package.json']
	}
};
