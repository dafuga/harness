import type { Generated } from './template.app-pieces.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	apiFiles,
	componentFiles,
	hookFiles,
	layoutFiles,
	storeFiles,
	viewFiles
} from '../../src/templates/development-tooling/appPieces';

const unitId = 'template.app-pieces';

function summarise(files: Generated[]): { files: string[]; markerLines: string[] } {
	return {
		files: files.map((file) => file.path),
		markerLines: files.flatMap((file) =>
			file.contents
				.split('\n')
				.filter((line) => line.includes('data-harness') || line.startsWith('test('))
				.map((line) => line.trim())
		)
	};
}

test('Plans a component and its test file', () => {
	const files = componentFiles('evidence-grid');
	expect(summarise(files).files).toEqual([
		'src/components/EvidenceGrid.svelte',
		'test/components/evidence-grid.test.ts'
	]);
	expect(files[0]?.contents).toContain('data-harness-component="evidence-grid"');
	expect(files[0]?.contents).toContain("let { label = 'EvidenceGrid' }");

	const names = ['evidence-grid', 'profile-card'];
	const cases = names.map((name) => ({
		name: `${name} plans a PascalCase component and a kebab-case test`,
		input: name,
		output: summarise(componentFiles(name))
	}));
	recordExampleCases(
		{
			unitId,
			symbol: 'componentFiles',
			state: 'plans-a-component-and-its-test-file',
			evidence: 'examples-cases',
			file: 'plans-a-component-and-its-test-file.json'
		},
		cases
	);
});

test('Plans a view route with a spaced title', () => {
	const files = viewFiles('audit-log');
	expect(summarise(files).files).toEqual([
		'src/routes/audit-log/+page.svelte',
		'test/routes/audit-log-view.test.ts'
	]);
	expect(files[0]?.contents).toContain("const title = 'Audit Log';");
	expect(files[0]?.contents).toContain('data-harness-view="audit-log"');

	const cases = ['reports', 'audit-log'].map((name) => ({
		name: `${name} plans a route page`,
		input: name,
		output: summarise(viewFiles(name))
	}));
	recordExampleCases(
		{
			unitId,
			symbol: 'viewFiles',
			state: 'plans-a-view-route-with-a-spaced-title',
			evidence: 'examples-cases',
			file: 'plans-a-view-route-with-a-spaced-title.json'
		},
		cases
	);
});

test('Plans a route layout with a children slot', () => {
	const files = layoutFiles('reports');
	expect(summarise(files).files).toEqual([
		'src/routes/reports/+layout.svelte',
		'test/routes/reports-layout.test.ts'
	]);
	expect(files[0]?.contents).toContain('{@render children()}');
	expect(files[0]?.contents).toContain('data-harness-layout="reports"');

	const cases = ['reports', 'admin'].map((name) => ({
		name: `${name} plans a layout with a children slot`,
		input: name,
		output: summarise(layoutFiles(name))
	}));
	recordExampleCases(
		{
			unitId,
			symbol: 'layoutFiles',
			state: 'plans-a-route-layout-with-a-children-slot',
			evidence: 'examples-cases',
			file: 'plans-a-route-layout-with-a-children-slot.json'
		},
		cases
	);
});

test('Plans an API route that returns ok JSON', () => {
	const files = apiFiles('audit-log');
	expect(summarise(files).files).toEqual([
		'src/routes/api/audit-log/+server.ts',
		'test/routes/audit-log-api.test.ts'
	]);
	expect(files[0]?.contents).toContain("return json({ ok: true, resource: 'audit-log' });");

	const cases = ['audit-log', 'reports'].map((name) => ({
		name: `${name} plans a GET handler that returns ok JSON`,
		input: name,
		output: summarise(apiFiles(name))
	}));
	recordExampleCases(
		{
			unitId,
			symbol: 'apiFiles',
			state: 'plans-an-api-route-that-returns-ok-json',
			evidence: 'examples-cases',
			file: 'plans-an-api-route-that-returns-ok-json.json'
		},
		cases
	);
});

test('Plans a store with a camelCase file name', () => {
	const files = storeFiles('filter-state');
	expect(summarise(files).files).toEqual([
		'src/lib/stores/filterState.svelte.ts',
		'test/stores/filter-state.test.ts'
	]);
	expect(files[0]?.contents).toContain('export function createFilterStateStore(');
	expect(files[0]?.contents).toContain('let value = $state(initialValue);');

	const cases = ['filter-state', 'selected-row'].map((name) => ({
		name: `${name} plans a create store function and a kebab-case test`,
		input: name,
		output: summarise(storeFiles(name))
	}));
	recordExampleCases(
		{
			unitId,
			symbol: 'storeFiles',
			state: 'plans-a-store-with-a-camelcase-file-name',
			evidence: 'examples-cases',
			file: 'plans-a-store-with-a-camelcase-file-name.json'
		},
		cases
	);
});

test('Plans a hook as a SvelteKit handle', () => {
	const files = hookFiles('session');
	expect(summarise(files).files).toEqual([
		'src/hooks/sessionHook.server.ts',
		'test/hooks/session.test.ts'
	]);
	expect(files[0]?.contents).toContain('export const sessionHook: Handle = async');
	expect(files[0]?.contents).toContain('return resolve(event);');

	const cases = ['session', 'request-context'].map((name) => ({
		name: `${name} plans an exported Handle named with the Hook suffix`,
		input: name,
		output: summarise(hookFiles(name))
	}));
	recordExampleCases(
		{
			unitId,
			symbol: 'hookFiles',
			state: 'plans-a-hook-as-a-sveltekit-handle',
			evidence: 'examples-cases',
			file: 'plans-a-hook-as-a-sveltekit-handle.json'
		},
		cases
	);
});
