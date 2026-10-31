import type { Guide } from '../development-tooling/guide';

const scenarioGuide: Guide = {
	topic: 'scenario',
	summary: 'A scenario contract lists the states, viewports, checks and evidence that prove units.',
	steps: [
		'Name the units the scenario proves and every state they can be in.',
		'Mark a state required, missing or inapplicable, with a reason for the last two.',
		'List viewports for visual states and the checks that produce the evidence.',
		'Declare each evidence requirement: kind, states, viewports and, for audio, provenance.',
		'Run harness scenarios show to see the exact captures a passing run must contain.'
	],
	rules: [
		'Scenario contracts live in specification/scenarios, one JSON file per scenario.',
		'A missing state can occur but is unproven: the scenario cannot pass until it is covered.',
		'An inapplicable state cannot occur; lacking a fixture is not an applicability reason.',
		'Every required state needs required evidence, and excluded states need none.',
		'Screenshots are PNG: viewport size, full-page at viewport width, or element captures ' +
			'matching explicit clip bounds and viewport scale. Audio is WAV, must be playable, and ' +
			'carries a transcript and its fixture or actual-capture provenance.',
		'A capture of running software carries a build stamp naming the verified commit.',
		'The shared browser fixture keeps error diagnostics with each recorded check, including expected errors and missing expected errors. Component Evidence and Tests show these with their test, retry and original revision.',
		'Declare compiled output in harness.verify.json builds and name it in the evidence: the ' +
			'stamp must then carry the identity of exactly the files setup compiled in the snapshot. ' +
			'An old bundle relabelled with the current revision is rejected.',
		'harness verify identity <directory> prints that identity; a server reports the identity ' +
			'of the files it was started from, read once at start.',
		'Checks capture only when TAKE_SCREENSHOT is 1; harness verify always sets it.'
	],
	antiPatterns: [
		'Do not relabel an unproven state as inapplicable.',
		'Do not make evidence optional to get a scenario to pass.'
	],
	exampleCommands: [
		'harness scenarios list',
		'harness scenarios show checkout-page',
		'harness scenarios check'
	]
};

const verifyGuide: Guide = {
	topic: 'verify',
	summary: 'Verify one exact commit in a clean snapshot and keep the record, pass or fail.',
	steps: [
		'Commit the change; uncommitted work is never part of a verification.',
		'Run harness verify run to export the commit, run its affected checks and judge every gate.',
		'Read the failures; each names the unit, scenario or file it concerns.',
		'Run harness verify check to confirm a stored record proves the commit.'
	],
	rules: [
		'Impact over the base and head graphs selects the tests and scenarios; uncertainty widens it.',
		'A record is a statement about the whole commit. The base only narrows what reruns when a ' +
			'passing, intact record proves it; otherwise the nearest proven ancestor is used, or ' +
			'nothing, and everything since then is checked. --base, an empty commit or an ' +
			'unverified parent therefore cannot leave a change out.',
		'Every check runs in its own process group under a hard limit. On macOS only a verified ' +
			'private process is signalled; other systems stop the process group.',
		'Parent links are observed every 200 ms. On macOS ownership is bound to id and start ' +
			'time, and identity and program are checked again before each signal. A vetted ' +
			'released system service is handed over; protected or unproven leftovers receive ' +
			'no further signals and fail the check. Unreadable state or an expired cleanup deadline ' +
			'fails as unknown. Logs distinguish stopped, signalled-but-running and unsignalled processes.',
		'Affected scenarios are captured afresh for each commit, even when the bytes are identical.',
		'An unaffected scenario keeps the evidence of the commit that last tested it, and says so; ' +
			'evidence is inherited only from a record that passed.',
		'The gates are snapshot, registry, ledger, tests, scenarios, reasons and budgets.',
		'The snapshot must stay the exact commit. It is compared after setup and after every check: ' +
			'a tracked file that changes or disappears, and any file that appears outside a ' +
			'declared output, fails the snapshot gate, even if a later check undoes it.',
		'Declare build output, caches and reports as outputs in harness.verify.json. A trailing ' +
			'slash names a directory. An output may not cover a tracked file, so source cannot be ' +
			'declared away.',
		'Records are drafts in .cache/harness/verifications until they are stored as Git evidence.',
		'harness.verify.json configures setup commands, shared paths, outputs, runners and time limits; a test file that needs a command of its own, such as another configuration of its runner, is listed under checks.',
		'A compiled build whose server cannot read its own files, such as a Worker, is stamped after its last build step with harness verify stamp; the server reports the stamp and harness verify identity confirms it belongs to exactly those files.'
	],
	antiPatterns: [
		'Do not treat a run on a dirty working tree as verification.',
		'Do not edit a record: its id is the hash of its content.',
		'Do not let a check write generated code beside source; build it in setup into a declared output.'
	],
	exampleCommands: [
		'harness verify run',
		'harness verify run --commit HEAD~1 --test-timeout 120000',
		'harness verify run --base none',
		'harness verify check --commit HEAD --json'
	]
};

const explainGuide: Guide = {
	topic: 'explain',
	summary: 'Every changed function or unit needs a reason: behaviour, simplification, performance.',
	steps: [
		'Run harness explain list to see which changes still need a reason.',
		'Record the behaviour change, what was tried to simplify it and what was tried for speed.',
		'Give each attempt an outcome: improved, not-improved or not-applicable.',
		'Run harness explain check before committing.'
	],
	rules: [
		'A reason is bound to the exact content it explains and goes stale when the code changes again.',
		'Verification asks for reasons from the nearest proven revision to the commit. A change made ' +
			'in several commits is explained by the reasons of each step, in order.',
		'A range is explained when every change has a reason for the range as a whole, or when each ' +
			'step along its first-parent history is explained in full. A step without a reason is not ' +
			'covered by the steps around it.',
		'Added and removed units need a unit-wide reason; so do files the index cannot split.',
		'A performance rationale is required for every changed unit, including validation, ' +
			'serialization and adapters at an invocation boundary, even when nothing improved.',
		'Reasons are kept outside the source tree in .cache/harness until they are stored as notes.',
		'A reason is short: its behaviour note has at most 30 words and 200 characters, each attempt ' +
			'at most 15 words and 140 characters. harness explain add refuses a longer one, and a ' +
			'repository that declares "writing": 2 in harness.verify.json fails its check and its ' +
			'verification on one.',
		'A revision that declares "writing": 1 keeps 20 words an attempt. A reason is held to the ' +
			'version of the revision it explains, each step of a range to its own and a reason for ' +
			'the whole range to that of its head; the date a reason carries decides nothing.'
	],
	antiPatterns: [
		'Do not write a blanket reason for unrelated changes.',
		'Do not list everything a change touched: explain this unit, the attempt and its result.',
		'Do not claim an improvement that was not measured.'
	],
	exampleCommands: [
		'harness explain list',
		'harness explain add --unit service.billing --symbol BillingService.charge --behavior "Retries once." ' +
			'--simplification "Removed the queue." --simplification-outcome improved ' +
			'--performance "Batched lookups; no measurable change." --performance-outcome not-improved',
		'harness explain check'
	]
};

const budgetGuide: Guide = {
	topic: 'budget',
	summary: 'Size, complexity and performance limits are frozen and change only by recorded review.',
	steps: [
		'Run harness verify run; a new unit fails until its baseline is established.',
		'A reviewer runs harness budget establish with the clean record that measured the unit.',
		'To accept growth or a slowdown, a reviewer runs harness budget approve with a reason.',
		'Commit the ledger; verification of that commit checks the new line cites a real record.'
	],
	rules: [
		'Source bytes, complexity and dependencies may not grow past the baseline at all.',
		'What a unit is built into has a frozen size too, one for each execution target: a process ' +
			'binary and a Wasm module each keep their own limit under artifact-bytes:<target>, so ' +
			'one cannot grow by what the other lost. Several artifacts declared for one target are ' +
			'one size, their sum, with the hash of each. The size is the one measured from the ' +
			'build of the verified snapshot, judged whenever the unit is judged, also when only ' +
			'something it is built from changed. A module emits nothing and has no such limit. An ' +
			'output that was measured at the baseline and is no longer built fails; one that could ' +
			'not be built when the limits were reviewed is stated; and one the baseline does not ' +
			'cover, because the unit did not emit it then or its limits are older than these, needs ' +
			'harness budget approve before it passes.',
		'Performance may be at most 5% worse than the baseline for the same workload, execution ' +
			'target and machine profile. Noise is answered with more comparable samples, never ' +
			'with a wider tolerance.',
		'A missing measurement, a missing baseline or a baseline from another profile never passes.',
		'Decision points are counted in TypeScript, JavaScript and Svelte. Stylesheets, markup ' +
			'without a script and data files have none to count. A unit with code in any other ' +
			'language has no complete complexity: no value at all when nothing in it is counted, ' +
			'otherwise the points of its counted files with a note of what they leave out. A file ' +
			'that is not read has no size either. Zero is only ever a count.',
		'Dependencies are the units a unit depends on plus the distinct outside modules its files ' +
			'refer to, as far as references are read: in TypeScript, JavaScript, Svelte and ' +
			'stylesheets. Code in another language, packages a manifest such as Cargo.toml declares ' +
			'and references that could not be resolved are not in the number, and the number says so; ' +
			'when nothing of a unit is read and nothing is known there is no number. Transitive ' +
			'dependencies are never counted.',
		'A frozen metric that cannot be measured is written into the baseline as such, with the ' +
			'reason, when a reviewer establishes it; every later record states it and does not judge ' +
			'it. A number that existed at the baseline cannot become unavailable, and a metric that ' +
			'becomes measurable needs a reviewed limit before it passes.',
		'A workload name is only a label. A baseline freezes the unit of measure, the method and a ' +
			'comparison context: the hash of the complete request, the measured boundary, the ' +
			'protocol and the sampling. A measurement is compared only when all of them are ' +
			'identical; any difference is incompatible and missing metadata is incomplete.',
		'harness budget bench and harness kernel bench --boundary derive the context from the ' +
			'request they send and the sampling they use. Any other benchmark capture must state ' +
			'its own valid context; Harness compares it exactly but cannot prove what a script ran.',
		'A changed workload, sampling, unit or method needs a reviewer to approve a baseline for ' +
			'the new definition. The ledger keeps the earlier definition and value.',
		'When a change reaches a unit with a performance budget, directly or through a dependency, ' +
			'its benchmark scenario reruns and the whole invocation boundary is compared: ' +
			'validation, serialization, the adapter and the call.',
		'Limits come only from a record of a clean commit whose other gates passed. Calibration ' +
			'files, dirty runs and failed records are refused.',
		'The reviewer cannot be the author of the measured change.',
		'The ledger in specification/budgets is append-only; baselines and approvals are never rewritten.',
		'A unit recreated from retired source inherits the retired limits through its lineage.'
	],
	antiPatterns: [
		'Do not edit the ledger by hand.',
		'Do not retire and recreate a unit to escape its limits.',
		'Do not benchmark only the inner function when the budget is on the boundary.',
		'Do not shrink a workload or its sampling under an unchanged name.'
	],
	exampleCommands: [
		'harness budget status',
		'harness budget bench function.rank --workload specification/workloads/rank-20k.json',
		'harness budget establish function.rank --record <id> --reviewer "Ada" --reason "Initial limits."',
		'harness budget approve function.rank --record <id> --reviewer "Ada" --reason "Adds caching."',
		'harness budget history function.rank'
	]
};

export const verificationGuides: Guide[] = [scenarioGuide, verifyGuide, explainGuide, budgetGuide];
