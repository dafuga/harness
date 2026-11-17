import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type {
	CleanCodeReport,
	CleanCodeSettings,
	PrincipleAssessment
} from '../../src/audit/development-tooling/cleanCodeTypes';

const settings: CleanCodeSettings = {
	mode: 'advisory', model: 'example-reviewer', minConfidence: 0.8,
	apiKeyEnv: 'REVIEW_KEY', exclude: ['generated/']
};

const assessment: PrincipleAssessment = {
	type: 'choice', choice: 'meets', confidence: 0.96,
	probabilities: { meets: 0.96, violates: 0.04 },
	principle: 'clear-names', title: 'Use clear names',
	guidance: 'Names should explain their purpose.', status: 'meets',
	location: { startLine: 3, endLine: 3, excerpt: 'const accountName = ...' }
};

const report: CleanCodeReport = {
	mode: settings.mode, status: 'clean', rubricVersion: '1',
	requestedModel: settings.model, minConfidence: settings.minConfidence,
	coverage: {
		selectedFiles: ['src/account.ts'],
		excludedPaths: [{ path: 'generated/', reason: 'configured exclusion' }],
		unsupportedFiles: []
	},
	files: [{
		path: 'src/account.ts', contentHash: 'content-hash', contextHash: 'context-hash',
		status: 'clean', assessments: [assessment], contextPaths: [], omittedContext: [],
		usage: { input_tokens: 120, output_tokens: 24 }, cached: false
	}],
	usage: { input_tokens: 120, output_tokens: 24 }
};

test('Describes a clean code review report', () => {
	const summary = {
		mode: report.mode, status: report.status,
		selectedFiles: report.coverage.selectedFiles,
		assessmentStatus: report.files[0]?.assessments[0]?.status,
		usage: report.usage
	};
	expect(summary).toEqual({
		mode: 'advisory', status: 'clean', selectedFiles: ['src/account.ts'],
		assessmentStatus: 'meets', usage: { input_tokens: 120, output_tokens: 24 }
	});
	recordExampleCases(
		{
			unitId: 'audit.clean-code-types', symbol: 'CleanCodeReport',
			state: 'describes-a-clean-code-review-report', evidence: 'examples-cases',
			file: 'describes-a-clean-code-review-report.json'
		},
		[{ name: 'advisory review summary', input: settings, output: summary }]
	);
});
