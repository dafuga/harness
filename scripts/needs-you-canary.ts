// @harness-uid u_av6woivt3a
/**
 * Post-release check of needs-you on production (specification/features/planned/
 * needs-you-release-canary.md). Exit 0: all surfaces passed. Exit 10: the release is held.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { automationChromeTab } from './needs-you-canary/automationChromeTab';
import { canaryArguments } from './needs-you-canary/canaryArguments';
import { runCanary } from './needs-you-canary/runCanary';
import { trackerCli } from './needs-you-canary/trackerCli';

const automationChrome = 'http://127.0.0.1:9333';
const productionHub = 'https://dafuga-harness.pages.dev';

try {
	const input = canaryArguments(process.argv.slice(2));
	const report = await runCanary({
		release: input.release,
		taps: input.taps,
		tapTimeoutMs: input.tapTimeoutMs,
		tracker: trackerCli(input.tracker),
		web: () => automationChromeTab(automationChrome, productionHub),
		clock: {
			now: () => Date.now(),
			wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
		},
		nonce: () => randomBytes(3).toString('hex'),
		pick: (count) => randomInt(count),
		log: (line) => console.log(line)
	});
	console.log(report.passed ? 'needs-you canary PASSED' : 'needs-you canary NOT PASSED');
	process.exitCode = report.passed ? 0 : 10;
} catch (error) {
	console.error(`needs-you canary: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
}
