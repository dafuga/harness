import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { commandOutput, runHarness } from './support/cli';

test('complex multi-boundary feature audits cleanly before bad practices are added', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-complex-feature-'));
	try {
		await runHarness(['new', 'app', 'incident-digest-app'], root);
		const project = join(root, 'incident-digest-app');

		await generateIncidentDigestFeature(project);

		const cleanAudit = await runHarness(['audit', '.', '--coverage'], project);
		expect(cleanAudit.stdout).toContain('Harness audit passed');
		expect(cleanAudit.stdout).toContain('Unknown files: none');

		await writeBadPracticeFiles(project);
		const badAudit = await runHarness(['audit', '.'], project, false);
		const output = commandOutput(badAudit);

		expect(badAudit.exitCode).toBe(1);
		expect(output).toContain('harness-source-structure');
		expect(output).toContain('small-class');
		expect(output).toContain('svelte-script-lang');
		expect(output).toContain('shell-strict-mode');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

async function generateIncidentDigestFeature(project: string): Promise<void> {
	for (const [kind, names] of Object.entries(featurePieces)) {
		for (const name of names) {
			await runHarness(['generate', kind, name], project);
		}
	}
}

const featurePieces: Record<string, string[]> = {
	feature: ['IncidentDigest'],
	adapter: ['PrimaryDatabase', 'AnalyticsDatabase', 'Sendgrid', 'IncidentEnrichment'],
	repository: ['Incident', 'Tenant', 'Digest', 'AuditEvent'],
	service: [
		'IngestIncident',
		'DeduplicateIncident',
		'BuildDigest',
		'SendDigest',
		'RecordAuditEvent'
	],
	mailer: ['IncidentDigest', 'IncidentEscalation'],
	job: ['ProcessIncident', 'BuildDigest', 'SendDigest'],
	validator: ['IncidentPayload', 'DigestSchedule'],
	policy: ['Incident', 'Digest'],
	serializer: ['Incident', 'Digest'],
	api: ['Incidents', 'Digests'],
	component: ['IncidentTable', 'DigestPreview', 'TenantSwitcher'],
	migration: ['CreateIncidentDigests']
};

async function writeBadPracticeFiles(project: string): Promise<void> {
	await mkdir(join(project, 'src/managers'), { recursive: true });
	await mkdir(join(project, 'src/components'), { recursive: true });
	await mkdir(join(project, 'scripts'), { recursive: true });

	await writeFile(join(project, 'src/managers/IncidentDigestManager.ts'), bigManagerClass());
	await writeFile(
		join(project, 'src/components/bad-digest.svelte'),
		'<script>let title = "Bad digest";</script>\n<h1>{title}</h1>\n'
	);
	await writeFile(join(project, 'scripts/sync.sh'), '#!/bin/sh\necho $INCIDENT_ID\n');
}

function bigManagerClass(): string {
	return [
		'export class IncidentDigestManager {',
		...Array.from({ length: 121 }, (_, index) => `\tvalue${index} = ${index};`),
		'}'
	].join('\n');
}
