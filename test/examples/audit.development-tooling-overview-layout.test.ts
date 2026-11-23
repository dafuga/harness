import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, test } from 'vitest';
import { auditOverviewLayout } from '../../src/audit/development-tooling/overviewLayout';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { createTempDirectory } from '../support/temporary';

const symbol = 'auditOverviewLayout';
let root = '';
beforeAll(async () => {
	root = await createTempDirectory('harness-overview-layout-');
	mkdirSync(join(root, 'src/components'), { recursive: true });
	writeFileSync(
		join(root, 'src/components/CreateForm.svelte'),
		'<hx-form aria-label="New project"><hx-input name="name" /></hx-form>'
	);
	writeFileSync(
		join(root, 'src/components/ProjectList.svelte'),
		'<hx-ul><hx-li>Alpha</hx-li></hx-ul>'
	);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const limits = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
};
const marker = '<!-- @harness-view overview -->\n';
const imports =
	"<script lang=\"ts\">import CreateForm from './CreateForm.svelte'; import Modal from './Modal.svelte'; import ProjectList from './ProjectList.svelte';</script>\n";

function run(contents: string) {
	const relativePath = 'src/components/Home.svelte';
	const output = auditOverviewLayout({
		absolutePath: join(root, relativePath),
		relativePath,
		extension: '.svelte',
		contents,
		lines: contents.split('\n'),
		structuralLines: contents.split('\n'),
		limits,
		size: contents.length
	});
	return { input: { relativePath, contents }, output };
}

function meta(state: string) {
	return {
		unitId: 'audit.development-tooling-overview-layout',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Ignores screens that are not marked as an overview', () => {
	const state = 'ignores-screens-that-are-not-marked-as-an-overview';
	const unmarked = run(`${imports}<CreateForm /><hx-input name="q" />`);
	expect(unmarked.output).toEqual([]);

	recordExampleCases(meta(state), [{ name: 'skips an unmarked screen', ...unmarked }]);
});

test('Reports a form on an overview unless a dialog holds it', () => {
	const state = 'reports-a-form-on-an-overview-unless-a-dialog-holds-it';
	const inline = run(`${marker}${imports}<ProjectList /><CreateForm /><hx-textarea />`);
	expect(inline.output).toEqual([
		{
			path: 'src/components/Home.svelte',
			rule: 'overview-inline-form',
			message:
				'Open CreateForm in a dialog or on its own page; an overview screen shows no inline form.'
		},
		{
			path: 'src/components/Home.svelte',
			rule: 'overview-inline-form',
			message:
				'Open hx-textarea in a dialog or on its own page; an overview screen shows no inline form.'
		}
	]);
	const dialog = run(
		`${marker}${imports}<ProjectList /><Modal open title="New project"><CreateForm /></Modal><hx-dialog><hx-input /></hx-dialog>`
	);
	expect(dialog.output).toEqual([]);

	recordExampleCases(meta(state), [
		{ name: 'reports an inline form component and control', ...inline },
		{ name: 'allows forms held by dialogs', ...dialog }
	]);
});

test('Reports more than one primary button on an overview', () => {
	const state = 'reports-more-than-one-primary-button-on-an-overview';
	const two = run(
		`${marker}<hx-button class="primary">Open</hx-button><hx-button class="primary wide">Create</hx-button>`
	);
	expect(two.output).toEqual([
		{
			path: 'src/components/Home.svelte',
			rule: 'overview-single-primary',
			message: 'An overview screen has one primary button; found 2.'
		}
	]);
	const one = run(
		`${marker}<hx-button class="primary">Open</hx-button><hx-button>New project</hx-button>`
	);
	expect(one.output).toEqual([]);

	recordExampleCases(meta(state), [
		{ name: 'reports two primary buttons', ...two },
		{ name: 'allows one primary button', ...one }
	]);
});
