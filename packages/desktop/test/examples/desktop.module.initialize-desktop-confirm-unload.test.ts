import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { confirmUnload } from '../../src/lib/development-tooling/desktop-initialization/initialize-desktop/confirmUnload';
import type {
	UnloadListener,
	ExampleWindow,
	ExampleDialog,
	UnloadEvent
} from './desktop.module.initialize-desktop-confirm-unload.test.types';

const meta = (state: string) => ({
	unitId: 'desktop.module.initialize-desktop-confirm-unload',
	symbol: 'confirmUnload',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

function fireUnload(choice: number) {
	const listeners: UnloadListener[] = [];
	const dialogCalls: Array<{ parentIsWindow: boolean; options: unknown }> = [];
	const browserWindow = {
		webContents: {
			on: (name: string, listener: UnloadListener) => {
				if (name === 'will-prevent-unload') listeners.push(listener);
			}
		}
	} as unknown as ExampleWindow;
	const dialogStub = {
		showMessageBoxSync: (parent: unknown, options: unknown) => {
			dialogCalls.push({ parentIsWindow: parent === browserWindow, options });
			return choice;
		}
	} as unknown as ExampleDialog;
	confirmUnload(browserWindow, dialogStub);
	const event: UnloadEvent = {
		defaultPrevented: false,
		preventDefault: () => {
			event.defaultPrevented = true;
		}
	};
	for (const listener of listeners) listener(event);
	return { listenerCount: listeners.length, dialogCalls, unloadAllowed: event.defaultPrevented };
}

function summarize(choice: number) {
	const run = fireUnload(choice);
	return {
		listenersAdded: run.listenerCount,
		dialogCalls: run.dialogCalls.length,
		parentIsWindow: run.dialogCalls[0]?.parentIsWindow,
		dialog: run.dialogCalls[0]?.options,
		unloadAllowed: run.unloadAllowed
	};
}

test('Keeps the page open when the user chooses Stay', () => {
	const output = summarize(0);
	expect(output.unloadAllowed).toBe(false);
	expect(output.listenersAdded).toBe(1);
	expect(output.dialogCalls).toBe(1);
	expect(output.parentIsWindow).toBe(true);
	expect(output.dialog).toEqual({
		type: 'warning',
		buttons: ['Stay', 'Discard'],
		defaultId: 0,
		cancelId: 0,
		message: 'Discard unsaved changes?',
		detail: 'Stay keeps this window and its unsaved changes open.'
	});
	recordExampleCases(meta('keeps-the-page-open-when-the-user-chooses-stay'), [
		{ name: 'Stay (index 0) keeps the page and window open', input: { choice: 0 }, output }
	]);
});

test('Lets the unload go on only when Discard is chosen', () => {
	const discard = summarize(1);
	const other = summarize(2);
	expect(discard.unloadAllowed).toBe(true);
	expect(other.unloadAllowed).toBe(false);
	recordExampleCases(meta('lets-the-unload-go-on-only-when-discard-is-chosen'), [
		{ name: 'Discard (index 1) lets the unload go on', input: { choice: 1 }, output: discard },
		{ name: 'Any other index (2) keeps the page open', input: { choice: 2 }, output: other }
	]);
});
