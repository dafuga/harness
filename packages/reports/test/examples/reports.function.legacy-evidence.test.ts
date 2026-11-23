import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	legacyLink,
	legacyEvidence
} from '../../src/components/explorer-ui/harness-legacy/legacyEvidence';

type Report = Parameters<typeof legacyEvidence>[0];

const sameCommit = '0123456789abcdef0123456789abcdef01234567';
const otherCommit = 'fedcba9876543210fedcba9876543210fedcba98';

const imageReport: Report = {
	id: 'rpt-2024-06-01',
	title: 'Historical report media',
	mode: 'full',
	environment: 'local',
	status: 'passed',
	startedAt: '2024-06-01T12:00:00.000Z',
	revision: sameCommit,
	linked: sameCommit,
	gap: 'The report contains no additional commit explanation.',
	summary: 'Historical report media captured for the reports explorer.',
	checks: [],
	media: [
		{
			id: 'home',
			title: 'Reports explorer home',
			status: 'passed',
			capturedAt: '2024-06-01T12:00:00.000Z',
			viewport: '1440x900',
			media: 'media/reports/explorer-home.png',
			gap: '',
			mediaType: 'image/png'
		}
	]
};

const gapReport: Report = {
	id: 'rpt-2024-06-02',
	title: 'Legacy capture gaps',
	mode: 'full',
	environment: 'local',
	status: 'failed',
	startedAt: '2024-06-02T09:30:00.000Z',
	revision: null,
	linked: null,
	gap: 'The legacy report did not name a repository commit.',
	summary: 'Legacy captures were retained with a missing media file.',
	checks: [],
	media: [
		{
			id: 'missing-audio',
			title: 'Recorder output',
			status: 'not-proven',
			capturedAt: '2024-06-02T09:30:00.000Z',
			viewport: '1280x720',
			media: null,
			gap: 'The media file was not retained.',
			mediaType: 'audio/webm'
		}
	]
};

test('Legacy link names the same commit or the gap', () => {
	const sameLabel = legacyLink(imageReport, sameCommit);
	const otherLabel = legacyLink(imageReport, otherCommit);
	const gapLabel = legacyLink(gapReport, sameCommit);

	expect(sameLabel).toBe('Recorded for this commit');
	expect(otherLabel).toBe('Recorded for 0123456');
	expect(gapLabel).toBe('The legacy report did not name a repository commit.');
	recordExampleCases(
		{
			unitId: 'reports.function.legacy-evidence',
			symbol: 'legacyLink',
			state: 'legacy-link-names-the-same-commit-or-the-gap',
			evidence: 'examples-cases',
			file: 'legacy-link-names-the-same-commit-or-the-gap.json'
		},
		[
			{
				name: 'linked report matched to the same commit',
				input: { report: imageReport, commit: sameCommit },
				output: sameLabel
			},
			{
				name: 'linked report compared with another commit',
				input: { report: imageReport, commit: otherCommit },
				output: otherLabel
			},
			{
				name: 'unlinked report keeps its recorded gap',
				input: { report: gapReport, commit: sameCommit },
				output: gapLabel
			}
		]
	);
});

test('Legacy evidence keeps a linked image as legacy', () => {
	const evidence = legacyEvidence(imageReport);

	expect(evidence).toHaveLength(1);
	expect(evidence[0]).toMatchObject({
		id: 'legacy-rpt-2024-06-01-home',
		file: 'reports/explorer-home.png',
		status: 'passed',
		standing: 'Legacy report capture',
		missing: false,
		mediaType: 'image',
		mimeType: 'image/png'
	});
	expect(evidence[0]?.note).toContain('It named revision');
	recordExampleCases(
		{
			unitId: 'reports.function.legacy-evidence',
			symbol: 'legacyEvidence',
			state: 'legacy-evidence-keeps-a-linked-image-as-legacy',
			evidence: 'examples-cases',
			file: 'legacy-evidence-keeps-a-linked-image-as-legacy.json'
		},
		[
			{
				name: 'linked image keeps its file, standing and revision note',
				input: imageReport,
				output: evidence
			}
		]
	);
});

test('Legacy evidence marks a missing audio file', () => {
	const evidence = legacyEvidence(gapReport);

	expect(evidence).toHaveLength(1);
	expect(evidence[0]).toMatchObject({
		id: 'legacy-rpt-2024-06-02-missing-audio',
		file: '',
		status: 'not-proven',
		standing: 'Legacy report capture',
		missing: true,
		mediaType: 'audio',
		mimeType: 'audio/webm'
	});
	expect(evidence[0]?.provenance?.[2]?.value).toBe(
		'legacy report rpt-2024-06-02, linked to no commit'
	);
	recordExampleCases(
		{
			unitId: 'reports.function.legacy-evidence',
			symbol: 'legacyEvidence',
			state: 'legacy-evidence-marks-a-missing-audio-file',
			evidence: 'examples-cases',
			file: 'legacy-evidence-marks-a-missing-audio-file.json'
		},
		[
			{
				name: 'unlinked audio with no retained file is marked missing',
				input: gapReport,
				output: evidence
			}
		]
	);
});
