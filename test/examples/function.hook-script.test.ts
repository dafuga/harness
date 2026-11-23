import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { hookScript, managedHook } from '../../src/cli/program/hook-install-service/hookScript';
import {
	hookMarker,
	chainedSuffix,
	enabledFile,
	hookStages,
	stageFile
} from '../../src/utils/development-tooling/hookScript';

test('Hook scripts render stage-specific chaining and opt-in behavior', () => {
	const push = hookScript('pre-push');
	const commit = hookScript('commit-msg');
	const cases = [
		{
			name: 'pre-push reads stdin, chains the existing hook, and checks its worktree opt-in',
			input: { stage: 'pre-push' },
			output: {
				readsStdin: push.includes('input=$(cat)'),
				chainedPath: push.includes('pre-push.harness-chained'),
				optInPath: push.includes('harness-hooks'),
				pipedHarness: push.includes('printf'),
				marker: push.includes(hookMarker)
			}
		},
		{
			name: 'commit-msg passes the message path without stdin',
			input: { stage: 'commit-msg' },
			output: {
				chainedPath: commit.includes(`commit-msg${chainedSuffix}`),
				optInPath: commit.includes('harness-hooks-commit-msg'),
				messageArgument: commit.includes('harness hooks run commit-msg'),
				noStdin: commit.includes('</dev/null') && !commit.includes('input=$(cat)')
			}
		}
	];
	expect(cases.map((entry) => entry.output)).toEqual([
		{ readsStdin: true, chainedPath: true, optInPath: true, pipedHarness: true, marker: true },
		{ chainedPath: true, optInPath: true, messageArgument: true, noStdin: true }
	]);
	recordExampleCases(
		{
			unitId: 'function.hook-script',
			symbol: 'hookScript',
			state: 'hook-scripts-render-stage-specific-chaining-and-opt-in-behav',
			evidence: 'examples-cases',
			file: 'hook-scripts-render-stage-specific-chaining-and-opt-in-behav.json'
		},
		cases
	);
});

test('Hook stage names and marker checks preserve their simple mappings', () => {
	const inputs = ['pre-push', 'commit-msg', 'custom'];
	const cases = inputs.map((stage) => ({
		name: `stage ${stage} maps to its opt-in file`,
		input: { stage },
		output: stageFile(stage)
	}));
	const markerCases = [
		{
			name: 'ordinary hook is unmanaged',
			input: { text: '#!/bin/sh\nnpm run lint\n' },
			output: false
		},
		{
			name: 'marker mention counts as managed',
			input: { text: `echo ${hookMarker}` },
			output: true
		}
	];
	expect(cases.map((entry) => entry.output)).toEqual([
		'harness-hooks',
		'harness-hooks-commit-msg',
		'harness-hooks-custom'
	]);
	expect(markerCases.map((entry) => managedHook(entry.input.text))).toEqual([false, true]);
	expect({ hookStages, enabledFile }).toEqual({
		hookStages: ['pre-push', 'commit-msg'],
		enabledFile: 'harness-hooks'
	});
	recordExampleCases(
		{
			unitId: 'function.hook-script',
			symbol: 'stageFile',
			state: 'hook-stage-names-and-marker-checks-preserve-their-simple-map',
			evidence: 'examples-cases',
			file: 'hook-stage-names-and-marker-checks-preserve-their-simple-map.json'
		},
		[...cases, ...markerCases]
	);
});
