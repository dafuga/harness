import { test } from 'vitest';
import { projectSchema } from '../../src/utils/development-tooling/recordsSchema';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

export const projectInput = {
	id: '6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
	name: '  Quarterly launch review  ',
	sourceRepository: {
		id: 202,
		owner: 'acme-platform',
		name: 'release-service',
		private: true,
		installationId: 7
	},
	createdAt: '2026-11-16T10:00:00.000Z',
	ownerId: ' owner-0142 '
};
export function captureError(parse: () => unknown) {
	try {
		parse();
		return { name: 'NoError', issues: [] };
	} catch (error) {
		if (!(error instanceof Error)) return { name: 'UnknownError', issues: [] };
		const issues = (
			error as Error & {
				issues?: Array<{
					code: string;
					path: Array<string | number>;
					message: string;
				}>;
			}
		).issues;
		return {
			name: error.name,
			issues: (issues ?? []).map(({ code, path, message }) => ({ code, path, message }))
		};
	}
}
test('Parses a strict project record', () => {
	const accepted = projectSchema.parse(projectInput);
	const unknownField = { ...projectInput, visibility: 'team' };
	const rejected = captureError(() => projectSchema.parse(unknownField));
	const state = 'parses-a-strict-project-record';
	recordExampleCases(
		{
			unitId: 'collaboration.function.records-schema',
			symbol: 'projectSchema',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'valid project labels are trimmed and repository details are kept',
				input: projectInput,
				output: accepted
			},
			{ name: 'unknown project fields are rejected', input: unknownField, error: rejected }
		]
	);
	expect(accepted).toMatchObject({ name: 'Quarterly launch review', ownerId: 'owner-0142' });
	expect(rejected.name).toBe('ZodError');
	expect(rejected.issues.map(({ code }) => code)).toContain('unrecognized_keys');
});
