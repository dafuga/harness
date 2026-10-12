import { expect, test } from 'vitest';
import { chainedSuffix, enabledFile, hookScript, managedHook } from '../../src/utils/hookScript';

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
	const enabled = script.indexOf(`[ -f "$git_dir/${enabledFile}" ] || exit 0`);
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
