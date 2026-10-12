import { expect, test } from 'vitest';
import { fixtureNeedsDebug, iosBuildPlan, simulatorSigning } from '../scripts/ios-build-options';

test('a normal build is Debug or Release, never a fixture, and is signed without a team', () => {
	expect(iosBuildPlan([])).toEqual({ configuration: 'Debug', fixture: false, sync: false });
	expect(iosBuildPlan(['--release', '--sync'])).toEqual({
		configuration: 'Release',
		fixture: false,
		sync: true
	});
	expect(simulatorSigning).toContain('CODE_SIGN_IDENTITY=-');
	expect(simulatorSigning).toContain('DEVELOPMENT_TEAM=');
	expect(simulatorSigning.join(' ')).not.toMatch(/CODE_SIGNING_ALLOWED=NO|PROVISIONING/);
});

test('a fixture build is refused for Release before anything is built', () => {
	expect(iosBuildPlan(['--fixture'])).toEqual({
		configuration: 'Debug',
		fixture: true,
		sync: false
	});
	expect(iosBuildPlan(['--fixture', '--release'])).toEqual({ error: fixtureNeedsDebug });
	expect(iosBuildPlan(['--release', '--sync', '--fixture'])).toEqual({ error: fixtureNeedsDebug });
});

test('an option that is not known is refused, not ignored', () => {
	expect(iosBuildPlan(['--fixtures'])).toHaveProperty('error');
	expect(iosBuildPlan(['--configuration=Release'])).toHaveProperty('error');
});
