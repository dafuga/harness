/// <reference types="@sveltejs/kit" />
/// <reference path="../../src/lib/development-tooling/routeTypes.d.ts" />
import { test } from 'vitest';
import { resolve } from '$app/paths';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

test('Resolves a dynamic route ID with its required parameter', () => {
	const input = {
		routeId: '/projects/[projectId]/members',
		params: { projectId: 'project-example' }
	} as const;
	const output = resolve(input.routeId, input.params);

	expect(output).toBe('/projects/project-example/members');
	recordExampleCases(
		{
			unitId: 'hub.module.route-types-d',
			symbol: 'resolve',
			state: 'resolves-a-dynamic-route-id-with-its-required-parameter',
			evidence: 'examples-cases',
			file: 'resolves-a-dynamic-route-id-with-its-required-parameter.json'
		},
		[{ name: 'Project members route', input, output }]
	);
});
