import { expect, test } from 'vitest';
import { chainedSuffix, enabledFile, hookStages, stageFile } from '../../src/utils/hookScript';
import { hookScript, managedHook } from '../../src/services/hook-install-service/hookScript';
import { firstMessageHook, legacyPrePush } from '../support/legacyHooks';

test('hookScript chains the previous hook first and runs Harness only where it was enabled', () => {
	const script = hookScript('pre-push');
	expect(script.startsWith('#!/bin/sh\n')).toBe(true);
	const chained = script.indexOf(`pre-push${chainedSuffix}`);
	const enabled = script.indexOf(`[ -f "$git_dir/${enabledFile}" ] || exit 0`);
	const run = script.indexOf('hooks run pre-push');
	expect(chained).toBeGreaterThan(0);
	expect(enabled).toBeGreaterThan(chained);
	expect(run).toBeGreaterThan(enabled);
	expect(script).toContain('|| exit $?');
});

test('managedHook recognises the wrapper and nothing else', () => {
	expect(managedHook(hookScript('pre-push'))).toBe(true);
	expect(managedHook(hookScript('commit-msg'))).toBe(true);
	expect(managedHook('#!/bin/sh\nnpm test\n')).toBe(false);
});

test('the commit-msg wrapper hands on the message file and never waits for input', () => {
	const script = hookScript('commit-msg');
	expect(script.startsWith('#!/bin/sh\n')).toBe(true);
	// Git gives this hook a file and no input: nothing may read input that never ends.
	expect(script).not.toMatch(/\$\(cat\)|input=/);
	expect(script).toContain('</dev/null');
	const chained = script.indexOf(`commit-msg${chainedSuffix}`);
	const enabled = script.indexOf(`[ -f "$git_dir/${stageFile('commit-msg')}" ] || exit 0`);
	const run = script.indexOf('hooks run commit-msg');
	expect(chained).toBeGreaterThan(0);
	expect(enabled).toBeGreaterThan(chained);
	expect(run).toBeGreaterThan(enabled);
	// The hook that was there gets the same arguments, and its failure stops the commit.
	expect(script).toMatch(/"\$chained" "\$@" \|\| exit \$\?/);
	// The path of the message file reaches Harness as one argument, whatever it contains.
	expect(script).toContain('"$1"');
	// The push wrapper is the one that reads the pushed references, as before.
	expect(hookScript('pre-push')).toContain('input=$(cat)');
});

test('the push wrapper and its opt-in file are the ones earlier versions wrote, byte for byte', () => {
	// A worktree that opted in under one of them shares this file and keeps its one command file.
	expect(hookScript('pre-push')).toBe(legacyPrePush);
	expect(stageFile('pre-push')).toBe(enabledFile);
	expect(enabledFile).toBe('harness-hooks');
});

test('a stage offered later asks for an opt-in of its own, never for the one a push was given', () => {
	const later = hookStages.filter((stage) => stage !== 'pre-push');
	expect(later).toContain('commit-msg');
	for (const stage of later) {
		const [script, file] = [hookScript(stage), stageFile(stage)];
		expect([stage, file === enabledFile]).toEqual([stage, false]);
		expect(script).toContain(`[ -f "$git_dir/${file}" ] || exit 0`);
		expect(script).toContain(`harness=$(cat "$git_dir/${file}")`);
		// The file of the push opt-in is read nowhere in it: an earlier Harness is never started.
		expect([stage, script.includes(`/${enabledFile}"`)]).toEqual([stage, false]);
	}
	// No two stages share a file, so asking for one never asks for another.
	expect(new Set(hookStages.map(stageFile)).size).toBe(hookStages.length);
	// The wrapper that did ask the push opt-in is what this rule keeps from coming back.
	expect(firstMessageHook).toContain(`[ -f "$git_dir/${enabledFile}" ] || exit 0`);
	expect(hookScript('commit-msg')).not.toBe(firstMessageHook);
});
