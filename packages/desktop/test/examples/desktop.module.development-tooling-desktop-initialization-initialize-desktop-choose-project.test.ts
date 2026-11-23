import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { chooseProject } from '../../src/lib/development-tooling/desktop-initialization/initialize-desktop/chooseProject';
import type { BrowserWindow, Dialog } from 'electron';

test('Returns the selected project or null when no folder is selected', async () => {
	const window = {} as BrowserWindow;
	const calls: Array<{ window: BrowserWindow; options: unknown }> = [];
	const responses = [
		{ canceled: false, filePaths: ['/workspace/projects/harness-app'] },
		{ canceled: true, filePaths: [] },
		{ canceled: false, filePaths: [] }
	];
	const dialog = {
		showOpenDialog: async (owner: BrowserWindow, options: unknown) => {
			calls.push({ window: owner, options });
			return responses[calls.length - 1]!;
		}
	} as unknown as Dialog;
	const selected = await chooseProject(window, dialog);
	const canceled = await chooseProject(window, dialog);
	const empty = await chooseProject(window, dialog);
	const output = { selected, canceled, empty, calls: calls.map((call) => call.options) };
	expect(output).toEqual({
		selected: '/workspace/projects/harness-app',
		canceled: null,
		empty: null,
		calls: Array(3).fill({ title: 'Open a Harness project', properties: ['openDirectory'] })
	});
	expect(calls.every((call) => call.window === window)).toBe(true);
	recordExampleCases(
		{
			unitId:
				'desktop.module.development-tooling-desktop-initialization-initialize-desktop-choose-project',
			symbol: 'chooseProject',
			state: 'returns-the-selected-project-or-null-when-no-folder-is-selec',
			evidence: 'examples-cases',
			file: 'returns-the-selected-project-or-null-when-no-folder-is-selec.json'
		},
		[
			{
				name: 'Returns the first selected folder',
				input: { canceled: false, filePaths: ['/workspace/projects/harness-app'] },
				output: selected
			},
			{
				name: 'Returns null when the picker is canceled',
				input: { canceled: true, filePaths: [] },
				output: canceled
			},
			{
				name: 'Returns null when no path is provided',
				input: { canceled: false, filePaths: [] },
				output: empty
			}
		]
	);
});
