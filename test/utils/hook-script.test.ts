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
	expect(managedHook('#!/bin/sh\nnpm test\n')).toBe(false);
});
