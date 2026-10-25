import {
	harnessModuleGroupRules,
	harnessNamingRules,
	harnessRuleLimits,
	harnessRuleSummaries
} from '../../rules/explorer-ui/catalog';
import { bugRepairPolicy } from '../../utils/development-tooling/bugRepairPolicy';
import { atomicComponentRules } from '../development-tooling/atomicGuidance';

export function agentRules(projectType: string): string {
	return `# AGENTS.md\n\nThis is a Harness ${projectType}. Treat Harness as the operating contract for every code change in this project.\n\n## Required Harness Workflow\n\n- Read this file and the \`.codex/skills/harness/SKILL.md\` skill before changing code.\n- Use Harness generators for supported code shapes instead of hand-rolling new structure.\n- Ask \`harness info <topic>\` before adding unfamiliar code or choosing a scaffold shape.\n- For non-trivial work, ask what the loop should prove, search templates, then create or continue a \`harness loop\`.\n- Add or update a feature spec before implementation.\n- Write tests only in the five standard forms, and fix reported bugs by strengthening existing cases; see Standard Test Forms and Stable-Case Bug Policy.\n- Keep files small, focused, and aligned with \`harness.audit.json\` limits.\n- Run \`bun run check\` before handing work back; it includes formatting, type checks, lint, tests, build, and \`bun run audit\`.\n\n${machineResourceRules()}\n## Clean Code Review\n\n- Use \`harness info clean-code\` for optional Jev reviews.\n- Preview with \`harness audit . --clean-code --dry-run\`; reviews remain disabled until enabled.\n- Configure a project-owned credential and assess advisory results before enabling the gate.\n- Keep uncertain judgments visible and never call incomplete reviews clean.\n\n${regressionLoopRules()}\n${namingRules()}\n${screenshotRules()}\n## Code Rules\n\n${harnessRuleSummaries.map((rule) => `- ${rule}`).join('\n')}\n\nHard limits: files ${harnessRuleLimits.maxFileLines}, functions ${harnessRuleLimits.maxFunctionLines}, classes ${harnessRuleLimits.maxClassLines}, methods ${harnessRuleLimits.maxMethodLines}, nesting ${harnessRuleLimits.maxNestingDepth}.\n`;
}

export function skillRules(projectType: string): string {
	return `# Harness Project Discipline\n\nUse this skill whenever you are planning, implementing, reviewing, or verifying code in this Harness ${projectType}.\n\n## Operating Rules\n\n1. Treat \`harness info\`, Harness generators, and \`harness audit\` as mandatory project controls.\n2. Run \`harness info <topic>\` or \`harness info scaffolds --json\` before creating unfamiliar code shapes.\n3. For non-trivial work, ask what the loop should prove, search templates, then create or continue a \`harness loop\`.\n4. Prefer \`harness generate <kind> <name>\` for supported scaffolds, then adapt the generated file within Harness limits.\n5. Add or update the feature spec first so the intended behavior is explicit before implementation.\n6. Keep generated and hand-edited files inside the configured Harness rule limits.\n7. Use \`harness info clean-code\` for optional Jev review; preview coverage before enabling it, use a project-owned credential, and assess advisory results before gating.\n8. Verify with \`bun run check\` before handing work back.\n9. Write tests only in the five standard forms, and fix reported bugs by strengthening existing cases with fixed case counts.\n\n${regressionLoopRules()}\n${namingRules()}\n${screenshotRules()}\n${measurementRules()}\n## Hard Limits\n\n- Files: ${harnessRuleLimits.maxFileLines} lines.\n- Functions: ${harnessRuleLimits.maxFunctionLines} lines.\n- Classes: ${harnessRuleLimits.maxClassLines} lines.\n- Methods: ${harnessRuleLimits.maxMethodLines} lines.\n- Nesting: ${harnessRuleLimits.maxNestingDepth} levels.\n- Parameters: ${harnessRuleLimits.maxParameters}.\n- Classes per file: ${harnessRuleLimits.maxClassesPerFile}.\n`;
}

function regressionLoopRules(): string {
	return `${moduleTaskRules()}\n## Scaffold export coherence

- Change generated source, tests and public export plans together. Verify every generated export targets an emitted scaffold and run the standard focused CLI project-check scenario after a scaffold shape change.

## Helper implementation ownership

- Public shared helper implementations belong under src/helpers/<responsibility>/<camelName>.ts, with pure functions separated from component/service orchestration. Keep single-consumer helpers with their owner. Point helper source contracts and Source tabs only at the selected callable implementation, never all files of its owning module. Preserve supported import addresses with forwarding exports when needed; update active callers to the canonical helper source. Run the registry helper-source guard and the standard selected-helper Source browser test.

## Callable usage examples

- Every public helper needs committed usage examples in its callable contract: a real call, argument values, and expected output or error. Verify examples against the implementation; never invent outcomes.
- Use descriptive behavior titles, never numbered placeholders. Choose one representative example per distinct behavior; combine redundant inputs. Review the implementation to identify features, including meaningful error or empty states. Equal outputs alone do not establish duplication. A helper's unit cases are exactly its authored examples; add a boundary input as an example only when it documents a distinct behavior.
- Run \`harness units check\`: missing helper examples, placeholder titles and repeated titles or calls must fail. Re-indexing must preserve authored examples. Each helper detail page shows only its own examples at the viewed commit.

${testFormRules()}
## Bug and Regression Loops

${bugRepairPolicy()
	.map((rule) => `- ${rule}`)
	.join('\n')}
- Use \`harness loop create <name> --from bug-fix --goal <text>\` for bug repairs: reproduce with its strengthened standardized case failing before implementation, then repeat repair and the same unchanged case until it passes.
- Use \`--from regression-prevention\` for regressions requiring durable prevention: identify the root cause, propose the repair and guard, implement both, and include the guard, a strengthened standardized case, in normal project verification.
- Prove the guard rejects reintroducing the original failure in an isolated fixture or temporary workspace; restore the repair and prove the guard passes.
- Record failing and passing commands, assertions, and results as step evidence. Keep green/guard/verification steps pending while proof fails; the agent retries repairs and checks. Harness does not launch an AI repair runner or automatically complete steps.
- For affected UI paths, exercise the browser flow and capture fresh screenshots, then inspect the images before recording proof. Report blockers without claiming completion.
- Browser normal flows, including screenshot/video runs, must have no unexpected console.error or pageerror events. Use the shared browserTest fixture; watch extra contexts before navigation. Keep logs for expected errors and declare their exact messages and reasons in that test. For unexpected errors, prove a failing log assertion before repair, then rerun the same unchanged regression until the error disappears; preserve diagnostics and keep verification pending while errors remain.
- Shared browser fixtures must preserve lazy setup. When their dependencies change, prove API-only tests run with an unavailable browser executable alongside actual browser cases.
`;
}

const standardTestForms = [
	'## Standard Test Forms',
	'',
	"Use exactly these five forms. Each draws its cases from the entity's declared contract as a finite, documented matrix.",
	'',
	'1. Pages: Playwright screenshot matches of each declared page state at every required viewport (desktop, tablet and mobile).',
	'2. Components: Playwright screenshot matches of the component at rest, plus each declared interaction, prop and error state.',
	'3. Helpers: one unit case per authored example, asserting its documented output or error.',
	'4. Classes: one case per method and declared initialization or lifecycle state, including each declared error.',
	'5. APIs: structural complete JSON response matches for each supported prop and error matrix row.',
	'',
	'- Interaction, accessibility and console assertions stay inside the case that exercises them; they are never separate tests.',
	'- Other functions and classes map each distinct behavior onto the matching form. Do not add a sixth shape.',
	'- Projects without UI have no page or component cases; their modules use the helper, class and API forms.',
	'- Do not auto-accept screenshot baselines. Review each changed image before its baseline is updated.',
	'- Retain reviewed baselines through Harness evidence with source revision, media hash and review provenance. Never automatically accept a missing or changed image.',
	'- Matrices include boundaries, invalid inputs and prop combinations that change behavior. Static types and configuration use compiler, lint, build and audit checks.',
	'- Unsupported or missing coverage fails explicitly: a unit without its declared states, examples, methods or matrix rows is a reported gap. Never skip the case or cover it with another form.',
	'',
	'## Stable-Case Bug Policy',
	'',
	'- Do not write standalone bug regression tests. A reported bug strengthens the existing case of its form (its input, fixture, state or assertion) under the same registered title.',
	"- Keep each form's case count fixed. Add or remove a case only when the contract explicitly changes a capability: a declared state, prop, example, method, lifecycle state, error or matrix row.",
	'- A behavior with no existing case is a missing coverage category. Declare its capability in the contract first, then add one case of its form before the product repair.',
	'- Keep registered case titles and identities stable; verification records bind to them.',
	''
];

function testFormRules(): string {
	return standardTestForms.join('\n');
}

function moduleTaskRules(): string {
	return `## Module task handoff

- When a Codex session assigns module implementation, use \`harness task feature <id> --goal <text> --tldr <text>\` then \`harness task add --input <file>\`.
- Tasks require a registered module and a wantedContract with responsibility, inputs, outputs and errors. Harness commits the contract to refs/harness/tasks before pickup, preserving source HEAD and unrelated edits.
- Task prompts start with the shared feature goal and TLDR, followed by the module's overall goal and pinned wanted contract. Keep shared context stable across related tasks.
- Omitted models use auto: claude-haiku-5-5/medium, then gpt-6-luna/max only after confirmed Claude quota rejection. Explicit --model and --intelligence settings never silently fall back.
- Run \`harness task worker --worker <id> --watch\` for assignment pickup. Workers preserve isolated worktrees for review; normal verification is still required. Use one repository as the active queue owner and \`harness task sync <remote>\` for explicit handoff; divergence is never overwritten.
`;
}

function measurementRules(): string {
	return `## Measurement Evidence

- Every code change must collect source bytes, source lines, complexity and dependency counts for each added or directly changed unit from the exact committed tree. Measure each applicable emitted target from that snapshot's real build output. A failed or missing full verification record must not hide readable source measurements.
- Every changed executable unit must also have a representative measured workload in its normal behavior tests, even without a performance budget. Record fresh timing and a meaningful memory observation with the unit or callable, workload, method, samples, target, runtime profile and tested revision. Focused regression evidence and full verification both retain these observations.
- For pages, collect real route navigation timing and page JavaScript heap after fonts and images settle. Bind the capture to the server's verified build and revision. A client-side route change must not borrow the previous document's navigation timing. Name whole-page heap or whole-process RSS accurately, including shared code or runner overhead; never describe it as isolated unit memory.
- Page screenshot scenarios require navigation timing and scoped renderer memory at every required viewport. Collect both through the shared capture helper and retain them with the images.
- Do not complete a changed executable unit with applicable metrics left unmeasured. Extend its standard workload coverage and rerun it. If source, runtime, toolchain or safe memory attribution is unavailable, record the exact reason, keep that check open, and report the blocker; absence is never zero or a passing measurement.
- Refresh prepared history when measurement support changes and verify the delivered data as well as the renderer. Every entity kind must show figures from its selected commit; old missing placeholders must not override current source observations. A portable index without its Git source must be rebuilt from that source rather than borrowing the working tree.
- Show actual performance observations independently of budget declarations. Preserve workload, target and profile boundaries. A changed unit requires a fresh run; inherited observations of an unchanged unit keep their original revision and label. A focused benchmark does not grant full verification or approve a budget baseline.
`;
}

function screenshotRules(): string {
	return `## Screenshot Evidence

- A changed UI is not ready to hand off or merge while any required screenshot is missing. Capture each applicable page, tab/state and desktop, tablet and mobile viewport through its standard test, from the exact committed build. Fix capture failures and rerun; a green assertion alone is insufficient.
- Register and retain the original image bytes, hashes, unit, state, viewport, served build and revision in Harness evidence before temporary workspace cleanup. A scratch path, broken image URL or image in chat is not durable screenshot delivery.
- Layouts are reusable visual frames with a child-content slot; routing hosts, data loaders and options-only modules are not layouts. Reuse component cards with title, image and page-usage links. Capture the actual layout with a labelled Child content placeholder in its real child slot.
- Public category or route renames must inventory canonical and compatibility titles and links. Update exposed labels, preserve stable IDs and aliases, and extend the standard composition check across overview, details and history. Run affected downstream consumer tests alongside their typechecks. Run the affected package lint and audit as well. Include affected public-entry navigation checks even when broader suites are deferred. Preserve route, revision and access assertions while updating expected names.
- Full-frame previews own their content boundaries. Apply content-container styling inside the frame, never around its navigation. When changing fixture context, extend the existing standard acceptance assertions for affected controls and inspect retained pixels before accepting the UI.
- Resolve a scenario screenshot slot to its declared units. A slot name is not a page identity; never fill a missing preview with another page's image.
- Rebuild or reopen the delivered history from its Git evidence, decode every required image, and inspect fresh screenshots before reporting completion. Both comparison sides need their own images; never substitute another unit, state or revision.
- After squash landing, check the actual remote base commit's prepared history and decode its visible previews. Identical complete Git trees may retain focused captures with their original revision and status; a different tree requires new captures. Feature-branch screenshots alone do not prove merged delivery.
- Complete and format tracked loop metadata before the final capture run. Keep that captured tree unchanged through landing; further tracked changes require fresh captures.
- Keep focused screenshots available even when full verification fails, with their focused run and outcome clearly labelled. They grant no full verification verdict. Missing or corrupt bytes keep the visual check open; report the exact blocker and continue the repair.
`;
}

function namingRules(): string {
	return `${atomicComponentRules()}\n## Naming\n\nRead \`harness info naming\` and the scaffold guide before naming code. Keep code names consistent across cards, usage links and detail headings.\n\n${[
		...Object.values(harnessNamingRules),
		...harnessModuleGroupRules
	]
		.map((rule) => `- ${rule}`)
		.join('\n')}\n`;
}

function machineResourceRules(): string {
	return [
		'## Machine Resources',
		'',
		'- Run coding tools through `harness resources run --priority coding --cpus auto --memory-mib auto -- <command>`.',
		'- Queue agent-needed tests with `--priority agent-test`; use `--priority environment` for background checks.',
		'- Use `harness resources status --json` before heavy work. Keep 10% CPU and max(10% RAM, 2 GiB) free.',
		'- Finish current tests under pressure and hold subsequent work; never suspend unrelated processes.',
		''
	].join('\n');
}
