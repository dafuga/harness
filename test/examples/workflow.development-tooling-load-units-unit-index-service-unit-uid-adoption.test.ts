import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	adoptUids,
	mergedByUid,
	unitUid
} from '../../src/workflows/development-tooling/load-units/unit-index-service/unitUidAdoption';
import type { SourceFile } from '../../src/core/development-tooling/sourceTypes';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import type {
	Group,
	Registry
} from '../../src/workflows/development-tooling/load-units/unit-index-service/UnitIndexService.types';
import type { SourceIndex } from '../../src/services/development-tooling/source-index-service/SourceIndexService';

const UNIT_ID = 'workflow.development-tooling-load-units-unit-index-service-unit-uid-adoption';
const UID = 'u_ivdxmstz3m';
const OLD_PATH = 'src/old/unitUidAdoption.ts';
const NEW_PATH = 'src/new/unitUidAdoption.ts';
const FORWARD_PATH = 'src/forward/unitUidAdoption.ts';
const IMPL_PATH = 'src/impl/unitUidAdoption.ts';
const PLAIN_PATH = 'src/plain/helper.ts';

function sourceFile(path: string, uid?: string): SourceFile {
	return {
		path,
		hash: '3f8a1c9e0b7d24a6e5f1c8b2d9047e3a6b5c1f0d',
		bytes: 2215,
		lines: 57,
		language: 'ts',
		classification: 'source',
		workspace: '',
		uid,
		read: true,
		decisions: 'counted',
		references: [],
		blocks: [],
		exports: [],
		errors: []
	};
}

function manifest(id: string, uid: string | undefined, source: string[] = []): ComponentManifest {
	return {
		id,
		uid,
		status: 'active',
		owns: { source, symbols: [] }
	} as unknown as ComponentManifest;
}

function groupOf(id: string, files: SourceFile[], uid?: string): Group {
	return { id, kind: 'workflow', uid, files };
}

function registryOf(units: ComponentManifest[], owners: Array<[string, string]>): Registry {
	const byId = new Map(units.map((unit) => [unit.id, unit] as const));
	return {
		byId,
		owners: new Map(owners),
		groups: new Map(),
		result: { moved: [] }
	} as unknown as Registry;
}

function indexOf(files: SourceFile[]): SourceIndex {
	return { revision: 'rev-1', files: new Map(files.map((file) => [file.path, file] as const)) };
}

function meta(state: string, symbol: string) {
	return { unitId: UNIT_ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Adopts a moved source file by the uid it announces', () => {
	const registry = registryOf([manifest(UNIT_ID, UID, [OLD_PATH])], [[OLD_PATH, UNIT_ID]]);
	const returned = adoptUids(registry, indexOf([sourceFile(NEW_PATH, UID)]));

	expect(returned).toBe(registry);
	expect(registry.owners.get(NEW_PATH)).toBe(UNIT_ID);
	expect(registry.result.moved).toEqual([{ id: UNIT_ID, from: OLD_PATH, to: NEW_PATH }]);
	recordExampleCases(meta('adopts-a-moved-source-file-by-the-uid-it-announces', 'adoptUids'), [
		{
			name: 'file moved to a new path keeps the unit and is reported as moved',
			input: { unit: { id: UNIT_ID, uid: UID, owns: [OLD_PATH] }, index: [NEW_PATH] },
			output: { owners: Object.fromEntries(registry.owners), moved: registry.result.moved }
		}
	]);
});

test('Merges groups that announce the same uid into the first id', () => {
	const groups = [
		groupOf('z.impl', [sourceFile(IMPL_PATH, UID)]),
		groupOf('a.forward', [sourceFile(FORWARD_PATH, UID)]),
		groupOf('m.plain', [sourceFile(PLAIN_PATH)])
	];
	const merged = mergedByUid(groups);

	expect(merged.map((group) => group.id)).toEqual(['a.forward', 'm.plain']);
	expect(merged[0].uid).toBe(UID);
	expect(merged[0].files.map((file) => file.path)).toEqual([FORWARD_PATH, IMPL_PATH]);
	expect(merged[1].uid).toBeUndefined();
	recordExampleCases(
		meta('merges-groups-that-announce-the-same-uid-into-the-first-id', 'mergedByUid'),
		[
			{
				name: 'groups sharing a file uid merge; a group without a uid is kept',
				input: { ids: ['z.impl', 'a.forward', 'm.plain'] },
				output: merged.map((group) => ({
					id: group.id,
					uid: group.uid ?? null,
					files: group.files.map((file) => file.path)
				}))
			}
		]
	);
});

test('Returns the stored unit uid before any group or file uid', () => {
	const files = [sourceFile(NEW_PATH, 'u_file')];
	const stored = unitUid(manifest(UNIT_ID, 'u_stored'), groupOf(UNIT_ID, [], 'u_group'), files);
	const fromGroup = unitUid(manifest(UNIT_ID, undefined), groupOf(UNIT_ID, [], 'u_group'), files);
	const fromFile = unitUid(undefined, undefined, files);

	expect(stored).toBe('u_stored');
	expect(fromGroup).toBe('u_group');
	expect(fromFile).toBe('u_file');
	recordExampleCases(meta('returns-the-stored-unit-uid-before-any-group-or-file-uid', 'unitUid'), [
		{
			name: 'stored uid wins over the group and file uids',
			input: { previous: 'u_stored', group: 'u_group', files: ['u_file'] },
			output: stored
		},
		{
			name: 'group uid is used when the stored unit has none',
			input: { previous: null, group: 'u_group', files: ['u_file'] },
			output: fromGroup
		},
		{
			name: 'file uid is used when neither the unit nor the group has one',
			input: { previous: null, group: null, files: ['u_file'] },
			output: fromFile
		}
	]);
});

test('Returns undefined when the files announce conflicting uids', () => {
	const agreeing = unitUid(undefined, undefined, [
		sourceFile(OLD_PATH, UID),
		sourceFile(NEW_PATH, UID)
	]);
	const conflicting = unitUid(undefined, undefined, [
		sourceFile(OLD_PATH, 'u_a'),
		sourceFile(NEW_PATH, 'u_b')
	]);

	expect(agreeing).toBe(UID);
	expect(conflicting).toBeUndefined();
	recordExampleCases(
		meta('returns-undefined-when-the-files-announce-conflicting-uids', 'unitUid'),
		[
			{
				name: 'files that agree on one uid give that uid',
				input: { files: [UID, UID] },
				output: agreeing ?? null
			},
			{
				name: 'files announcing different uids give no uid',
				input: { files: ['u_a', 'u_b'] },
				output: conflicting ?? null
			}
		]
	);
});
