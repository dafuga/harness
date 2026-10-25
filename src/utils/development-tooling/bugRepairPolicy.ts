/** Shared contract-driven test and regression rules for generated projects and app agent runs. */
const rules = [
	'For a reported bug, first diagnose why existing tests missed it. Name the responsible standardized test or scenario and its missing inputs, lifecycle, fixture or assertion; record the coverage gap before product repair.',
	"Strengthen the existing standardized test and shared fixtures or assertions using the project's Harness scenario, state, viewport, registered-test and evidence format. Do not add a one-off bug-specific regression test.",
	"Use exactly these five contract-driven test forms. Each draws its cases from the entity's declared contract as a finite, documented matrix.",
	'Pages: Playwright screenshot matches of each declared page state at every required viewport (desktop, tablet and mobile).',
	'Components: Playwright screenshot matches of the component at rest, plus each declared interaction, prop and error state.',
	'Helpers: one unit case per authored example, asserting its documented output or error.',
	'Classes: one case per method and declared initialization or lifecycle state, including each declared error.',
	'APIs: structural complete JSON response matches for each supported prop and error matrix row.',
	'Interaction, accessibility and console assertions stay inside the case that exercises them; they are never separate tests.',
	'Other functions and classes map each distinct behavior onto the matching form. Do not add a sixth shape.',
	'Unsupported or missing test coverage is an explicit validation failure; report the missing coverage category and declare the capability in the contract before adding its matching case. Never skip it, invent a case, or use another form.',
	'Do not write standalone bug regression tests. A reported bug strengthens the existing case of its form under the same registered title.',
	"For bug repairs, do not increase case counts. Keep each form's case count fixed. Add or remove a case only when the contract explicitly changes a capability: a declared state, prop, example, method, lifecycle state, error or matrix row.",
	'Keep registered case titles and identities stable; verification records bind to them.',
	'Do not auto-accept screenshot baselines. Review each changed image before its baseline is updated.',
	'Retain reviewed baselines through Harness evidence with source revision, media hash and review provenance. Never automatically accept a missing or changed image.',
	'Matrices include boundaries, invalid inputs and prop combinations that change behavior. Static types and configuration use compiler, lint, build and audit checks.',
	'Run the strengthened test against the broken implementation and record the failing command, assertion and observed result before repair. A fixture or environment error is not defect proof; never manufacture a failure.',
	'Before changing product code, commit the failing test separately. Run harness loop record <loop> --phase red --test <path> --command <command> --assertion <actual failure> on that commit. Then make a separate fix commit and run loop record --phase green: the tests, fixtures, command and environment must be unchanged. Preserve both commits when landing; do not squash away the failing-test commit. Focused regression results do not replace full verification.',
	'Repair the product while keeping the strengthened test unchanged. Repeat repair and the same unchanged test until it passes; retain failing and passing evidence at their tested revisions, then run normal verification.',
	'When correcting function names or APIs, parameter names describe their domain role; rename source declarations and update callers and contracts, rather than inventing display labels. Diagnose why the original name or API was accepted, then repair the earliest responsible generator, skill or review checkpoint within the authorized project scope. Verify the revised guidance is emitted for generated projects.',
	'For helper catalogs, prove one selected callable per detail page: distinct links for functions sharing a source module, only that callable’s parameters, return and throws, and selection retained across tabs and revisions. Keep module ownership/history explicit; a missing callable must not silently show a sibling.',
	'During read-only planning, report the coverage diagnosis and propose the standardized test change; do not edit tests or product source. Write only within an approved implementation request.'
];

export function bugRepairPolicy(): string[] {
	return [...rules];
}
