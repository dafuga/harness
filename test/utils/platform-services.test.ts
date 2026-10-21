import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	classifyProcess,
	macAuthority,
	type ServiceAuthority
} from '../../src/utils/platformServices';
import type { TrackedProcess } from '../../src/utils/processDescendants';
import {
	adopted,
	alive,
	child,
	cleared,
	journal,
	pause,
	syntheticServices,
	type SyntheticServices
} from '../support/syntheticServices';

/**
 * Which processes a command may hand to the system, which it may not end, and which are its
 * own. Every process here is a stand-in that these tests start; nothing of Apple's is run.
 */
const mac = process.platform === 'darwin';
let made: SyntheticServices;
beforeAll(() => {
	if (mac) made = syntheticServices();
});
afterAll(async () => {
	if (mac) await cleared(made.home);
});

const forLong = (name: string) => ['30', join(made.home, name)];
/** How a process stands under the given tools, for a command whose group is the given one. */
async function standing(known: TrackedProcess, authority?: ServiceAuthority, group = 1) {
	const context = { authority: () => authority ?? made.authority, group };
	return (await classifyProcess(known, context)).standing;
}

test.skipIf(!mac)(
	'the vetted service, vouched for, departed and adopted, is delegated',
	async () => {
		for (const service of made.authority.services) {
			const known = adopted(join(made.authority.root, service.path), forLong('vetted'));
			expect(await standing(known)).toBe('delegated');
		}
	}
);

test.skipIf(!mac)(
	'a service under another identity earns nothing, though it sits at the path',
	async () => {
		for (const service of made.other.services) {
			const other = adopted(join(made.other.root, service.path), forLong('other'));
			expect(await standing(other, made.other)).toBe('protected');
		}
	}
);

test.skipIf(!mac)('a look-alike elsewhere and a link at the vetted path earn nothing', async () => {
	expect(await standing(adopted(made.lookAlike, forLong('alike')))).toBe('protected');
	const linked = adopted(join(made.linked.root, 'usr/bin/ibtoold'), forLong('linked'));
	expect(await standing(linked, made.linked)).toBe('protected');
});

test.skipIf(!mac)('tools that nothing vouches for cannot vouch for their service', async () => {
	const unvouched = { ...made.authority, rootRequirement: 'identifier "harness.synthetic.none"' };
	expect(await standing(adopted(made.service, forLong('unvouched')), unvouched)).toBe('protected');
});

test.skipIf(!mac)('a service that has not left its command is not delegated', async () => {
	const own = Number(execFileSync('ps', ['-p', String(process.pid), '-o', 'pgid=']).toString());
	expect(await standing(child(made.service, forLong('inside')), undefined, own)).toBe('protected');
	expect(await standing(child(made.service, forLong('apart'), true))).toBe('protected');
});

test.skipIf(!mac)(
	'a process whose program cannot be read is protected, never private',
	async () => {
		const [copy, ready] = [join(made.home, 'vanishing'), join(made.home, 'vanishing.ready')];
		copyFileSync(made.helper, copy);
		const unreadable = adopted(copy, [...forLong('vanished'), ready]);
		// Its file is removed only once the stand-in says that it runs its own code: a program
		// that is still being loaded may end with its file, and that would show nothing here.
		for (let waited = 0; !existsSync(ready) && waited < 5000; waited += 20) await pause(20);
		expect(existsSync(ready)).toBe(true);
		rmSync(copy);
		expect(alive(unreadable)).toBe(true);
		expect(await standing(unreadable)).toBe('protected');
		expect([alive(unreadable), journal(join(made.home, 'vanished'))]).toEqual([true, '']);
	}
);

test.skipIf(!mac)(
	'another process under the same id is not the one that was followed',
	async () => {
		const bystander = adopted('/bin/sleep', ['30']);
		const replaced = { pid: bystander.pid, started: 'Thu Jan  1 00:00:00 1970' };
		expect(await standing(replaced)).toBe('gone');
		expect(alive(bystander)).toBe(true);
	}
);

test.skipIf(!mac)(
	"other tools are the command's own, Apple-signed or not; a launcher is not",
	async () => {
		mkdirSync(join(made.home, 'another'));
		for (const name of ['ibtool', 'IBAgent-iOS'])
			symlinkSync('/bin/sleep', join(made.home, 'another', name));
		expect(await standing(adopted('/bin/sleep', ['30']))).toBe('private');
		expect(await standing(adopted(made.helper, forLong('helper')))).toBe('private');
		for (const name of ['ibtool', 'IBAgent-iOS'])
			expect(await standing(adopted(join(made.home, 'another', name), ['30']))).toBe('protected');
	}
);

test.skipIf(!mac || !macAuthority())('the installed tools satisfy what is asked of them', () => {
	const real = macAuthority()!;
	const verify = (args: string[]) =>
		execFileSync('codesign', ['--verify', ...args], { stdio: 'pipe' });
	expect(real.services.map((service) => service.path)).toEqual([
		'usr/bin/ibtoold',
		'Platforms/iPhoneSimulator.platform/Developer/Library/Xcode/Overlays/IBAgent-iOS'
	]);
	for (const service of real.services) {
		expect(service.requirement).toContain('anchor apple');
		verify([`-R=${service.requirement}`, join(real.root, service.path)]);
	}
	expect(real.rootRequirement).toContain('anchor apple');
	verify(['--ignore-resources', `-R=${real.rootRequirement}`, real.rootCode]);
});
