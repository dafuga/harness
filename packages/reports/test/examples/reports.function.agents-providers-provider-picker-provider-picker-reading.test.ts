import { test } from 'vitest';
import type { PickerModel, ProviderSelection } from '../../../../src/core/development-tooling/pickerModelTypes';
import type { SwitchRequest } from '../../../../src/core/development-tooling/pickerTypes';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	failureText,
	isSnapshot,
	readSessions,
	selectionLabel
} from '../../src/components/agents-providers/provider-picker/providerPickerReading';

const SESSION_ID = '3f2b9c1e-7a4d-4e8b-9c2f-1a2b3c4d5e6f';
const FALLBACK = 'Model switch failed.';

const sessionRequest: SwitchRequest = {
	id: 'switch-7c1e0b92',
	sessionId: SESSION_ID,
	target: { provider: 'openai', model: 'gpt-5-codex', effort: 'medium' },
	status: 'pending',
	createdAt: '2026-11-14T09:30:00.000Z',
	reason: 'Switched in the model picker.'
};

const catalog: PickerModel[] = [
	{
		provider: 'harness-claude',
		model: 'claude-sonnet-5-5',
		label: 'Claude Sonnet 5.5',
		efforts: ['low', 'medium', 'high'],
		defaultEffort: 'medium',
		source: 'local-catalog'
	},
	{
		provider: 'openai',
		model: 'gpt-5-codex',
		label: 'GPT-5 Codex',
		efforts: ['low', 'medium', 'high'],
		defaultEffort: 'medium',
		source: 'local-catalog'
	}
];

const knownSelection: ProviderSelection = { provider: 'openai', model: 'gpt-5-codex', effort: 'medium' };
const unknownSelection: ProviderSelection = { provider: 'openai', model: 'gpt-4.1', effort: 'low' };

test('Recognises a picker snapshot by its default provider', () => {
	const snapshot = {
		sessionId: SESSION_ID,
		defaultProvider: 'openai',
		active: null,
		request: null,
		models: [],
		controlConnected: false,
		message: 'Desktop control connection unavailable. Requests stay pending; no provider settings change.'
	};
	const queued = { sessions: [] };
	expect(isSnapshot(snapshot)).toBe(true);
	expect(isSnapshot(queued)).toBe(false);
	expect(isSnapshot(null)).toBe(false);
	recordExampleCases(
		{
			unitId: 'reports.function.agents-providers-provider-picker-provider-picker-reading',
			symbol: 'isSnapshot',
			state: 'recognises-a-picker-snapshot-by-its-default-provider',
			evidence: 'examples-cases',
			file: 'recognises-a-picker-snapshot-by-its-default-provider.json'
		},
		[
			{ name: 'snapshot names the default provider', input: snapshot, output: true },
			{ name: 'queued-sessions response has no default provider', input: queued, output: false },
			{ name: 'null response is not a snapshot', input: null, output: false }
		]
	);
});

test('Reads queued sessions or null when no list is present', () => {
	const queued = { sessions: [sessionRequest] };
	const empty = { sessions: [] };
	const notList = { sessions: 'none' };
	expect(readSessions(queued)).toEqual([sessionRequest]);
	expect(readSessions(empty)).toEqual([]);
	expect(readSessions(notList)).toBeNull();
	expect(readSessions(null)).toBeNull();
	recordExampleCases(
		{
			unitId: 'reports.function.agents-providers-provider-picker-provider-picker-reading',
			symbol: 'readSessions',
			state: 'reads-queued-sessions-or-null-when-no-list-is-present',
			evidence: 'examples-cases',
			file: 'reads-queued-sessions-or-null-when-no-list-is-present.json'
		},
		[
			{ name: 'queued response returns its pending switch', input: queued, output: [sessionRequest] },
			{ name: 'empty queue returns an empty list', input: empty, output: [] },
			{ name: 'non-array sessions value returns null', input: notList, output: null },
			{ name: 'null response returns null', input: null, output: null }
		]
	);
});

test('Labels a selection from the catalog or its model id', () => {
	expect(selectionLabel(catalog, knownSelection)).toBe('GPT-5 Codex');
	expect(selectionLabel([], knownSelection)).toBe('gpt-5-codex');
	expect(selectionLabel(catalog, unknownSelection)).toBe('gpt-4.1');
	recordExampleCases(
		{
			unitId: 'reports.function.agents-providers-provider-picker-provider-picker-reading',
			symbol: 'selectionLabel',
			state: 'labels-a-selection-from-the-catalog-or-its-model-id',
			evidence: 'examples-cases',
			file: 'labels-a-selection-from-the-catalog-or-its-model-id.json'
		},
		[
			{
				name: 'catalog entry supplies the label for a known selection',
				input: { models: catalog, target: knownSelection },
				output: 'GPT-5 Codex'
			},
			{
				name: 'empty catalog returns the model id',
				input: { models: [], target: knownSelection },
				output: 'gpt-5-codex'
			},
			{
				name: 'unlisted model returns its id, not a display name',
				input: { models: catalog, target: unknownSelection },
				output: 'gpt-4.1'
			}
		]
	);
});

test('Uses an Error message or fallback for other throws', () => {
	const timeout = new Error('Request timed out');
	expect(failureText(timeout, FALLBACK)).toBe('Request timed out');
	expect(failureText(new Error(''), FALLBACK)).toBe('');
	expect(failureText('Request timed out', FALLBACK)).toBe(FALLBACK);
	expect(failureText({ code: 'ETIMEDOUT', message: 'Request timed out' }, FALLBACK)).toBe(FALLBACK);
	expect(failureText(null, FALLBACK)).toBe(FALLBACK);
	recordExampleCases(
		{
			unitId: 'reports.function.agents-providers-provider-picker-provider-picker-reading',
			symbol: 'failureText',
			state: 'uses-an-error-message-or-fallback-for-other-throws',
			evidence: 'examples-cases',
			file: 'uses-an-error-message-or-fallback-for-other-throws.json'
		},
		[
			{
				name: 'Error instance contributes its message',
				input: { cause: { type: 'Error', message: 'Request timed out' }, fallback: FALLBACK },
				output: 'Request timed out'
			},
			{
				name: 'Error with empty message keeps the empty text',
				input: { cause: { type: 'Error', message: '' }, fallback: FALLBACK },
				output: ''
			},
			{
				name: 'thrown string gives the fallback',
				input: { cause: 'Request timed out', fallback: FALLBACK },
				output: FALLBACK
			},
			{
				name: 'plain object with a message gives the fallback',
				input: { cause: { code: 'ETIMEDOUT', message: 'Request timed out' }, fallback: FALLBACK },
				output: FALLBACK
			},
			{ name: 'null gives the fallback', input: { cause: null, fallback: FALLBACK }, output: FALLBACK }
		]
	);
});
