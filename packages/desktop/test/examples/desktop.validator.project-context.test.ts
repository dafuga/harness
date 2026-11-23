import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ProjectContextValidator } from '../../src/validators/projects-sessions/ProjectContextValidator';
import { ExplicitProjectRequiredError } from '../../src/validators/projects-sessions/ProjectContextValidator.types';

const validator = new ProjectContextValidator();
const projectId = 'local-9a3f0c71e5b24d86a1c0f7e39d52b846c1e0a9f3d7b25c84e6a1f0d93b7c2e58';
const draftComment = {
	requestId: '6f1d2c3b-4a5e-4b7c-8d9e-0f1a2b3c4d5e',
	anchor: {
		entityId: 'harness.project.discussion',
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null,
		branch: 'main',
		commit: 'c3a1e9f07d24b6583e0a9c1f7d4b2e6a85f0d931'
	},
	text: 'Can the release checklist move above the evidence grid?'
};

test('validates project context across operation channels', () => {
	const selected = validator.operation('project:select', { projectId });
	const capabilities = validator.operation('project:capabilities', { projectId });
	const ignored = validator.operation('unlisted:channel', { projectId });
	const list = validator.operation('project:list', { projectId });

	expect(selected).toEqual({ projectId });
	expect(capabilities).toEqual({ projectId });
	expect(ignored).toBeUndefined();
	expect(list).toBeNull();
	recordExampleCases(
		{
			unitId: 'desktop.validator.project-context',
			symbol: 'operation',
			state: 'validates-project-context-across-operation-channels',
			evidence: 'examples-cases',
			file: 'validates-project-context-across-operation-channels.json'
		},
		[
			{
				name: 'explicit project selection',
				input: { channel: 'project:select', payload: { projectId } },
				output: selected
			},
			{
				name: 'capability lookup',
				input: { channel: 'project:capabilities', payload: { projectId } },
				output: capabilities
			},
			{
				name: 'unknown channel ignores payload',
				input: { channel: 'unlisted:channel', payload: { projectId } },
				output: null
			},
			{
				name: 'project list has no context result',
				input: { channel: 'project:list', payload: { projectId } },
				output: list
			}
		]
	);
});

test('validates draft thread comments and drops unrelated fields', () => {
	const input = { ...draftComment, ignored: 'not copied' };
	const output = validator.operation('thread:comment', input);

	expect(output).toEqual(draftComment);
	recordExampleCases(
		{
			unitId: 'desktop.validator.project-context',
			symbol: 'comment',
			state: 'validates-draft-thread-comments-and-drops-unrelated-fields',
			evidence: 'examples-cases',
			file: 'validates-draft-thread-comments-and-drops-unrelated-fields.json'
		},
		[{ name: 'draft discussion comment', input, output }]
	);
});

test('requires an explicit project for project selection', () => {
	let thrown: unknown;
	try {
		validator.operation('project:select', {});
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(ExplicitProjectRequiredError);
	expect(thrown).toMatchObject({ message: 'Select an explicit project.' });
	recordExampleCases(
		{
			unitId: 'desktop.validator.project-context',
			symbol: 'operation',
			state: 'requires-an-explicit-project-for-project-selection',
			evidence: 'examples-cases',
			file: 'requires-an-explicit-project-for-project-selection.json'
		},
		[
			{
				name: 'selection without project id',
				input: { channel: 'project:select', payload: {} },
				error: { name: 'ExplicitProjectRequiredError', message: 'Select an explicit project.' }
			}
		]
	);
});

test('Throws Error when project context is not an object', () => {
	let thrown: unknown;
	try {
		validator.context(null);
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toMatchObject({ name: 'IpcFieldError', message: 'Expected an object.' });
	recordExampleCases(
		{
			unitId: 'desktop.validator.project-context',
			symbol: 'context',
			state: 'throws-error-when-project-context-is-not-an-object',
			evidence: 'examples-cases',
			file: 'throws-error-when-project-context-is-not-an-object.json'
		},
		[
			{
				name: 'null project context',
				input: null,
				error: { name: 'IpcFieldError', message: 'Expected an object.' }
			}
		]
	);
});
