import type { Guide } from './guide';

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
		'Screenshots are PNG and must decode to the viewport size, or be at least as tall when ' +
			'the evidence declares a full-page capture. Audio is WAV, must be playable, and ' +
			'carries a transcript and its fixture or actual-capture provenance.',
		'A capture of running software carries a build stamp naming the verified commit.',
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
		'Every check runs in its own process group under a hard limit and is killed with its children.',
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
		'harness.verify.json configures setup commands, shared paths, outputs, runners and time limits.'
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
		'Added and removed units need a unit-wide reason; so do files the index cannot split.',
		'A performance rationale is required for every changed unit, including validation, ' +
			'serialization and adapters at an invocation boundary, even when nothing improved.',
		'Reasons are kept outside the source tree in .cache/harness until they are stored as notes.'
	],
	antiPatterns: [
		'Do not write a blanket reason for unrelated changes.',
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
		'Performance may be at most 5% worse than the baseline for the same workload, execution ' +
			'target and machine profile. Noise is answered with more comparable samples, never ' +
			'with a wider tolerance.',
		'A missing measurement, a missing baseline or a baseline from another profile never passes.',
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
