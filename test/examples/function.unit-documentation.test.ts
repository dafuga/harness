import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import type { SourceTree } from '../../src/core/development-tooling/sourceTypes';
import { hydrateUnitDocumentation } from '../../src/services/explorer-ui/revision-detail-service/unitDocumentation';
import {
	readUnitDocumentation,
	unitDocumentation
} from '../../src/utils/explorer-ui/unit-documentation/unitDocumentation';
import type { UnitDocumentation } from '../../src/utils/explorer-ui/unit-documentation/unitDocumentation.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * Each state calls the unit's real code the way its callers do: the parser on committed Markdown,
 * the reader on a temporary project folder standing in for a revision's tree, and the hydration on
 * prebuilt unit views. What it was given and what it returned, summarised to its fields, is asserted
 * and recorded as the cases of its state.
 */

const toolbarId = 'app.component.toolbar';
const toolbarPath = 'src/components/toolbar/usage.md';
const menuId = 'app.component.menu';
const menuPath = 'src/components/menu/usage.md';
const footerId = 'app.component.footer';
const footerPath = 'src/components/footer/usage.md';
const dividerId = 'app.component.divider';
const notAvailable = 'The document is not available at this commit.';
const otherEntity = 'The document belongs to another entity.';

const toolbarExamples = [
	{ name: 'Empty toolbar', input: { items: [] }, output: 'No actions' },
	{
		name: 'Disabled save',
		input: { items: [{ id: 'save', enabled: false }] },
		error: 'Action is disabled'
	}
];
const menuExamples = [{ name: 'Open the main menu', input: { open: true }, output: 'Menu shown' }];

/** Markdown with one harness-examples block for a unit, as an author commits it beside the unit. */
function documentWith(unitId: string, body: Record<string, unknown>): string {
	return (
		'# Usage\n\n```harness-examples\n' +
		JSON.stringify({ schemaVersion: 1, unitId, ...body }) +
		'\n```\n'
	);
}

const toolbarDoc = documentWith(toolbarId, {
	setup: '  const items = [];  ',
	examples: toolbarExamples
});
const menuDoc = documentWith(menuId, { examples: menuExamples });
const malformedDoc = documentWith(toolbarId, {
	examples: [{ name: 'Both', input: 1, output: 2, error: 3 }]
});
const brokenDoc = '# Usage\n\n```harness-examples\n{"schemaVersion": 1, "unitId":\n```\n';
const toolbarParsed = {
	path: toolbarPath,
	text: toolbarDoc,
	examples: toolbarExamples,
	setup: 'const items = [];'
};
const folderFiles: Record<string, string> = { [toolbarPath]: toolbarDoc };
const folder = { files: Object.keys(folderFiles) };

/** The fields a reviewer reads: the path, the parsed examples and setup, or the gap reason. */
function summaryOf(doc: UnitDocumentation | undefined) {
	if (!doc) return null;
	return { path: doc.path, examples: doc.examples, setup: doc.setup ?? null, gap: doc.gap ?? null };
}

/** A unit view as the hydration returns it; the verbatim text is the input and is not repeated. */
function viewOf(unit: { id: string; documentation?: UnitDocumentation }) {
	return { id: unit.id, documentation: summaryOf(unit.documentation) };
}

/** The reader's input: the project folder's files as the tree lists them, and the unit as passed. */
function readInput(unit: { id: string; documentation?: string }) {
	return { tree: folder, unit };
}

/** A project folder read as a revision's tree reads: a path's text, or an error when it is absent. */
function folderTree(root: string): Pick<SourceTree, 'read'> {
	return { read: (path) => readFile(join(root, path), 'utf8') };
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
	for (const [path, text] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), text);
	}
}

/** Records the cases of one state; the file is named by the state id, as the scenario's evidence expects. */
function record(symbol: string, state: string, cases: Parameters<typeof recordExampleCases>[1]) {
	recordExampleCases(
		{
			unitId: 'function.unit-documentation',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('unitDocumentation parsed a block per unit and trimmed setup', () => {
	const toolbar = unitDocumentation(toolbarDoc, toolbarId, toolbarPath);
	const menu = unitDocumentation(menuDoc, menuId, menuPath);
	expect(toolbar).toEqual(toolbarParsed);
	expect(menu).toEqual({ path: menuPath, text: menuDoc, examples: menuExamples });
	record('unitDocumentation', 'unitdocumentation-parsed-a-block-per-unit-and-trimmed-setup', [
		{
			name: 'toolbar block with setup padded by spaces, parsed for its own unit',
			input: { text: toolbarDoc, unitId: toolbarId, path: toolbarPath },
			output: summaryOf(toolbar)
		},
		{
			name: 'menu block without setup, parsed for its own unit',
			input: { text: menuDoc, unitId: menuId, path: menuPath },
			output: summaryOf(menu)
		}
	]);
});

test('unitDocumentation refused a foreign, doubled, or invalid block', () => {
	const doubledDoc = toolbarDoc + toolbarDoc;
	const foreign = unitDocumentation(toolbarDoc, menuId, menuPath);
	const doubled = unitDocumentation(doubledDoc, toolbarId, toolbarPath);
	const malformed = unitDocumentation(malformedDoc, toolbarId, toolbarPath);
	const invalid = unitDocumentation(brokenDoc, toolbarId, toolbarPath);
	expect(foreign).toEqual({ path: menuPath, text: toolbarDoc, examples: [], gap: otherEntity });
	expect(doubled.gap).toBe('The document needs one harness-examples block.');
	expect(malformed.gap).toBe('The documented examples are malformed.');
	expect(invalid.gap).toBe('The documented examples are not valid JSON.');
	expect([doubled, malformed, invalid].map((doc) => doc.examples)).toEqual([[], [], []]);
	record('unitDocumentation', 'unitdocumentation-refused-a-foreign-doubled-or-invalid-block', [
		{
			name: 'toolbar document offered to the menu unit is refused as belonging to another entity',
			input: { text: toolbarDoc, unitId: menuId, path: menuPath },
			output: summaryOf(foreign)
		},
		{
			name: 'two harness-examples blocks in one document are refused',
			input: { text: doubledDoc, unitId: toolbarId, path: toolbarPath },
			output: summaryOf(doubled)
		},
		{
			name: 'an example with both output and error is refused as malformed',
			input: { text: malformedDoc, unitId: toolbarId, path: toolbarPath },
			output: summaryOf(malformed)
		},
		{
			name: 'a block whose JSON stops early is refused as not valid JSON',
			input: { text: brokenDoc, unitId: toolbarId, path: toolbarPath },
			output: summaryOf(invalid)
		}
	]);
});

test('readUnitDocumentation read files and gave undefined or gaps', async () => {
	await withTempDir('unit-documentation-read-', async (root) => {
		await writeFiles(root, folderFiles);
		const tree = folderTree(root);
		const toolbar = await readUnitDocumentation(tree, {
			id: toolbarId,
			documentation: toolbarPath
		});
		const unlinked = await readUnitDocumentation(tree, { id: toolbarId });
		const absent = await readUnitDocumentation(tree, { id: footerId, documentation: footerPath });
		const foreign = await readUnitDocumentation(tree, { id: menuId, documentation: toolbarPath });
		expect(toolbar).toEqual(toolbarParsed);
		expect(unlinked).toBeUndefined();
		expect(absent).toEqual({ path: footerPath, examples: [], gap: notAvailable });
		expect(foreign?.gap).toBe(otherEntity);
		record('readUnitDocumentation', 'readunitdocumentation-read-files-and-gave-undefined-or-gaps', [
			{
				name: 'toolbar read from its path in the project folder and parsed',
				input: readInput({ id: toolbarId, documentation: toolbarPath }),
				output: summaryOf(toolbar)
			},
			{
				name: 'a unit without a documentation path gives undefined, recorded as null',
				input: readInput({ id: toolbarId }),
				output: summaryOf(unlinked)
			},
			{
				name: 'a documentation path missing from the project folder gives a gap',
				input: readInput({ id: footerId, documentation: footerPath }),
				output: summaryOf(absent)
			},
			{
				name: 'a path that names another unit document gives a gap for another entity',
				input: readInput({ id: menuId, documentation: toolbarPath }),
				output: summaryOf(foreign)
			}
		]);
	});
});

test('hydrateUnitDocumentation read each path and left other units', async () => {
	await withTempDir('unit-documentation-hydrate-', async (root) => {
		await writeFiles(root, folderFiles);
		const tree = folderTree(root);
		const divider = { id: dividerId };
		const units: Array<{ id: string; documentation?: UnitDocumentation }> = [
			{ id: toolbarId, documentation: { path: toolbarPath, examples: [] } },
			divider,
			{ id: footerId, documentation: { path: footerPath, examples: [] } }
		];
		const given = units.map(viewOf);
		const blank = { id: dividerId, documentation: { path: '', examples: [] } };
		const blankGiven = viewOf(blank);
		const blankBefore = blank.documentation;
		expect(await hydrateUnitDocumentation(tree, units)).toBeUndefined();
		expect(units[0].documentation).toEqual(toolbarParsed);
		expect(units[1]).not.toHaveProperty('documentation');
		expect(units[2].documentation).toMatchObject({ path: footerPath, gap: notAvailable });
		await hydrateUnitDocumentation(tree, [blank]);
		expect(blank.documentation).toBe(blankBefore);
		record(
			'hydrateUnitDocumentation',
			'hydrateunitdocumentation-read-each-path-and-left-other-units',
			[
				{
					name: 'toolbar read and replaced, divider without a path unchanged, footer missing from the folder gets a gap',
					input: { tree: folder, units: given },
					output: units.map(viewOf)
				},
				{
					name: 'a unit whose documentation path is empty is left unchanged',
					input: { tree: folder, units: [blankGiven] },
					output: [viewOf(blank)]
				}
			]
		);
	});
});
