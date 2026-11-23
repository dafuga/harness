import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	profileSchema,
	PermissionCatalogService
} from '../../src/services/networking-security/PermissionCatalogService';
import type {
	PermissionCatalog,
	PermissionSourceTree
} from '../../src/services/networking-security/PermissionCatalogService.types';

const profile = {
	schemaVersion: 1,
	id: 'read-only-audit',
	title: 'Read-only audit',
	description: 'Read access for audit reporting.',
	grants: [
		{
			kind: 'api',
			resource: 'reports',
			actions: ['GET'],
			data: [{ resource: 'reports', actions: ['read'], fields: ['id', 'status'], scope: 'tenant' }]
		},
		{ kind: 'page', resource: 'audit', actions: ['view'] },
		{ kind: 'data', resource: 'users', actions: ['read'], fields: ['id', 'email'], scope: 'tenant' }
	]
};

function summary(catalog: PermissionCatalog) {
	return {
		ids: catalog.profiles.map(({ id }) => id),
		sources: catalog.profiles.map(({ source }) => source),
		gaps: catalog.gaps
	};
}

function record(symbol: string, state: string, input: unknown, output: unknown) {
	recordExampleCases(
		{
			unitId: 'service.networking-security-permission-catalog',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: 'loads the declared profile and reports invalid entries', input, output }]
	);
}

test('Loads declared profiles and reports invalid files', async () => {
	await withTempDir('permission-catalog-load-', async (directory) => {
		const permissions = join(directory, 'specification', 'permissions');
		await mkdir(permissions, { recursive: true });
		await writeFile(join(permissions, 'read-only-audit.json'), JSON.stringify(profile));
		await writeFile(join(permissions, 'legacy.json'), '{');
		const output = await new PermissionCatalogService().load(directory);
		expect(summary(output)).toEqual({
			ids: ['read-only-audit'],
			sources: ['specification/permissions/read-only-audit.json'],
			gaps: ['Invalid permission profile: specification/permissions/legacy.json']
		});
		record(
			'PermissionCatalogService.load',
			'loads-declared-profiles-and-reports-invalid-files',
			{ root: directory, profiles: ['read-only-audit.json', 'legacy.json'] },
			summary(output)
		);
	});
});

test('Reads matching source paths and skips unrelated files', async () => {
	const validPath = 'specification/permissions/read-only-audit.json';
	const tree: PermissionSourceTree = {
		list: async () => [
			{ path: validPath },
			{ path: 'src/permissions/ignored.json' },
			{ path: 'specification/permissions/legacy.json' }
		],
		read: async (path) => (path === validPath ? JSON.stringify(profile) : '{')
	};
	const output = await new PermissionCatalogService().at(tree);
	expect(summary(output)).toEqual({
		ids: ['read-only-audit'],
		sources: [validPath],
		gaps: ['Invalid permission profile: specification/permissions/legacy.json']
	});
	record(
		'PermissionCatalogService.at',
		'reads-matching-source-paths-and-skips-unrelated-files',
		{ paths: [validPath, 'src/permissions/ignored.json', 'specification/permissions/legacy.json'] },
		summary(output)
	);
});

test('Rejects invalid permission profile shapes', () => {
	const result = profileSchema.safeParse({
		...profile,
		grants: [{ kind: 'page', resource: 'audit', actions: ['edit'] }]
	});
	expect(result.success).toBe(false);
	recordExampleCases(
		{
			unitId: 'service.networking-security-permission-catalog',
			symbol: 'profileSchema',
			state: 'rejects-invalid-permission-profile-shapes',
			evidence: 'examples-cases',
			file: 'rejects-invalid-permission-profile-shapes.json'
		},
		[
			{
				name: 'rejects an undeclared page action',
				input: {
					profile: { ...profile, grants: [{ kind: 'page', resource: 'audit', actions: ['edit'] }] }
				},
				output: { success: result.success }
			}
		]
	);
});
