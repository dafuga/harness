import type { ExampleCase } from './function.revision-changes.test.types';
import { test } from 'vitest';
import {
	revisionChanges,
	type ChangedUnits,
	type ChangesInput,
	type UnitVersions
} from '../../src/utils/development-tooling/revisionChanges';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const parent = 'b'.repeat(40);
const fallback = 'a'.repeat(40);
const none: ChangedUnits['units'] = { direct: [], indirect: [], added: [], removed: [] };

/** Calls revisionChanges with the input and keeps both what it was given and what it returned. */
function called(name: string, input: ChangesInput): ExampleCase {
	return { name, input, output: revisionChanges(input) };
}

function impact(base: string | null, units: Partial<ChangedUnits['units']>): ChangedUnits {
	return { base, units: { ...none, ...units } };
}

function registry(versions: Record<string, string>, available = true): UnitVersions {
	return { available, units: Object.entries(versions).map(([id, version]) => ({ id, version })) };
}

test('revisionChanges takes the changes a saved impact names and never lists its dependents', () => {
	const stored = called('a stored direct change is kept and its indirect dependents are not', {
		impact: impact(parent, {
			direct: ['function.slugify'],
			indirect: ['service.title', 'page.titles']
		}),
		registry: registry({ 'function.slugify': 'v2', 'service.title': 'v1', 'page.titles': 'p1' }),
		parent: registry({ 'function.slugify': 'v1', 'service.title': 'v1', 'page.titles': 'p1' })
	});
	const moved = called('a stored added unit is not also direct, and a removed one is listed', {
		impact: impact(parent, {
			direct: ['function.extra', 'function.kept'],
			added: ['function.extra'],
			removed: ['function.old']
		}),
		registry: registry({ 'function.extra': 'e1', 'function.kept': 'k1' }),
		parent: undefined
	});
	const fallbackBase = called('the fallback base applies when the stored impact has no base', {
		impact: impact(null, { direct: ['function.a'] }),
		registry: registry({ 'function.a': 'a1' }),
		parent: undefined,
		base: fallback
	});
	expect(stored.output).toEqual({
		base: parent,
		direct: ['function.slugify'],
		added: [],
		removed: []
	});
	expect(moved.output).toEqual({
		base: parent,
		direct: ['function.kept'],
		added: ['function.extra'],
		removed: ['function.old']
	});
	expect(fallbackBase.output).toEqual({
		base: fallback,
		direct: ['function.a'],
		added: [],
		removed: []
	});
	recordExampleCases(
		{
			unitId: 'function.revision-changes',
			symbol: 'revisionChanges',
			state: 'revisionchanges-changes-from-saved-impact',
			evidence: 'examples-cases',
			file: 'revisionchanges-changes-from-saved-impact.json'
		},
		[stored, moved, fallbackBase]
	);
});

test('revisionChanges derives changes from differences in registry unit versions', () => {
	const versions = called('a changed contract or dependency version is a direct change', {
		impact: null,
		registry: registry({ 'function.slugify': 'v2', 'config.titles': 'c2', 'function.clock': 'k1' }),
		parent: registry({ 'function.slugify': 'v1', 'config.titles': 'c1', 'function.clock': 'k1' }),
		base: parent
	});
	const presence = called(
		'a unit only in the commit is added and one only in the parent is removed',
		{
			impact: null,
			registry: registry({ 'function.new': 'n1', 'function.kept': 'k1' }),
			parent: registry({ 'function.gone': 'g1', 'function.kept': 'k1' }),
			base: parent
		}
	);
	const impactAdded = called(
		'a unit the impact lists as added is not also direct when its version moved',
		{
			impact: impact(parent, { added: ['function.extra'] }),
			registry: registry({ 'function.extra': 'e2' }),
			parent: registry({ 'function.extra': 'e1' })
		}
	);
	expect(versions.output).toEqual({
		base: parent,
		direct: ['config.titles', 'function.slugify'],
		added: [],
		removed: []
	});
	expect(presence.output).toEqual({
		base: parent,
		direct: [],
		added: ['function.new'],
		removed: ['function.gone']
	});
	expect(impactAdded.output).toEqual({
		base: parent,
		direct: [],
		added: ['function.extra'],
		removed: []
	});
	recordExampleCases(
		{
			unitId: 'function.revision-changes',
			symbol: 'revisionChanges',
			state: 'revisionchanges-registry-version-differences',
			evidence: 'examples-cases',
			file: 'revisionchanges-registry-version-differences.json'
		},
		[versions, presence, impactAdded]
	);
});

test('revisionChanges reports no false changes for unchanged units and null without evidence', () => {
	const unchanged = called(
		'unchanged units under an impact that names one as indirect report nothing',
		{
			impact: impact(parent, { indirect: ['service.title'] }),
			registry: registry({ 'function.a': 'a1', 'service.title': 'v1' }),
			parent: registry({ 'function.a': 'a1', 'service.title': 'v1' })
		}
	);
	const noImpact = called('unchanged registries and no impact report nothing', {
		impact: null,
		registry: registry({ 'function.a': 'a1', 'function.b': 'b1', 'config.c': 'c1' }),
		parent: registry({ 'function.a': 'a1', 'function.b': 'b1', 'config.c': 'c1' }),
		base: parent
	});
	const unheldParent = called('no impact and the parent registry not held gives null', {
		impact: null,
		registry: registry({ 'function.a': 'a1' }),
		parent: undefined
	});
	const unavailableCommit = called('no impact and an unavailable commit registry gives null', {
		impact: null,
		registry: registry({}, false),
		parent: registry({ 'function.a': 'a1' })
	});
	expect(unchanged.output).toEqual({ base: parent, direct: [], added: [], removed: [] });
	expect(noImpact.output).toEqual({ base: parent, direct: [], added: [], removed: [] });
	expect(unheldParent.output).toBeNull();
	expect(unavailableCommit.output).toBeNull();
	recordExampleCases(
		{
			unitId: 'function.revision-changes',
			symbol: 'revisionChanges',
			state: 'revisionchanges-no-false-changes',
			evidence: 'examples-cases',
			file: 'revisionchanges-no-false-changes.json'
		},
		[unchanged, noImpact, unheldParent, unavailableCommit]
	);
});
