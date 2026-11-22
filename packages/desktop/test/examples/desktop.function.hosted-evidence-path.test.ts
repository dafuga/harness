import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hostedEvidencePath } from '../../src/lib/development-tooling/desktop-initialization/remote-http-project-adapter/hosted-evidence-adapter/hostedEvidencePath';
import { InvalidHostedProjectError } from '../../src/lib/development-tooling/desktop-initialization/remote-http-project-adapter/hosted-evidence-adapter/hostedEvidencePath.types';

const entityInput = {
	projectId: 'reports-web',
	entityId: 'reports.component.evidence-grid',
	commit: '0123456789abcdef0123456789abcdef01234567',
	branch: 'main',
	mode: 'current' as const
};

test('builds ordered hosted evidence and artifact URLs', () => {
	const evidence = hostedEvidencePath(entityInput, 'evidence');
	const artifactInput = {
		...entityInput,
		side: 'after',
		recordId: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
		scenarioId: 'checkout-flow',
		state: 'signed-in',
		evidenceId: 'signup-page',
		sha256: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
		viewport: 'desktop-1440x900',
		notesRevision: 'abcdef0123456789abcdef0123456789abcdef01',
		evidenceRevision: 'fedcba9876543210fedcba9876543210fedcba98'
	};
	const artifact = hostedEvidencePath(artifactInput, 'artifact');

	expect(evidence).toBe(
		'/api/projects/reports-web/evidence?entityId=reports.component.evidence-grid&commit=0123456789abcdef0123456789abcdef01234567&branch=main&mode=current'
	);
	expect(artifact).toContain('&side=after&recordId=');
	expect(artifact).toContain('&notesRevision=abcdef0123456789abcdef0123456789abcdef01&evidenceRevision=fedcba9876543210fedcba9876543210fedcba98');
	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-evidence-path',
			symbol: 'hostedEvidencePath',
			state: 'builds-ordered-hosted-evidence-and-artifact-urls',
			evidence: 'examples-cases',
			file: 'builds-ordered-hosted-evidence-and-artifact-urls.json'
		},
		[
			{ name: 'evidence metadata URL', input: { ...entityInput, operation: 'evidence' }, output: evidence },
			{ name: 'artifact URL with capture bindings', input: { ...artifactInput, operation: 'artifact' }, output: artifact }
		]
	);
});

test('rejects an invalid hosted project identifier', () => {
	let thrown: unknown;
	try {
		hostedEvidencePath({ ...entityInput, projectId: 'bad/project' }, 'evidence');
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(InvalidHostedProjectError);
	expect(thrown).toMatchObject({ message: 'Invalid hosted project.' });
	if (!(thrown instanceof Error)) throw new Error('Expected an invalid hosted project error.');
	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-evidence-path',
			symbol: 'hostedEvidencePath',
			state: 'rejects-an-invalid-hosted-project-identifier',
			evidence: 'examples-cases',
			file: 'rejects-an-invalid-hosted-project-identifier.json'
		},
		[
			{
				name: 'reject project IDs containing a slash',
				input: { ...entityInput, projectId: 'bad/project', operation: 'evidence' },
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
