import { harnessRuleLimits, harnessRuleSummaries } from '../rules/catalog';
import { bugRepairPolicy } from '../utils/bugRepairPolicy';

export function agentRules(projectType: string): string {
	return `# AGENTS.md\n\nThis is a Harness ${projectType}. Treat Harness as the operating contract for every code change in this project.\n\n## Required Harness Workflow\n\n- Read this file and the \`.codex/skills/harness/SKILL.md\` skill before changing code.\n- Use Harness generators for supported code shapes instead of hand-rolling new structure.\n- Ask \`harness info <topic>\` before adding unfamiliar code or choosing a scaffold shape.\n- For non-trivial work, ask what the loop should prove, search templates, then create or continue a \`harness loop\`.\n- Add or update a feature spec before implementation.\n- Keep files small, focused, and aligned with \`harness.audit.json\` limits.\n- Run \`bun run check\` before handing work back; it includes formatting, type checks, lint, tests, build, and \`bun run audit\`.\n\n## Clean Code Review\n\n- Use \`harness info clean-code\` for optional Jev reviews.\n- Preview with \`harness audit . --clean-code --dry-run\`; reviews remain disabled until enabled.\n- Configure a project-owned credential and assess advisory results before enabling the gate.\n- Keep uncertain judgments visible and never call incomplete reviews clean.\n\n${regressionLoopRules()}\n## Code Rules\n\n${harnessRuleSummaries.map((rule) => `- ${rule}`).join('\n')}\n\nHard limits: files ${harnessRuleLimits.maxFileLines}, functions ${harnessRuleLimits.maxFunctionLines}, classes ${harnessRuleLimits.maxClassLines}, methods ${harnessRuleLimits.maxMethodLines}, nesting ${harnessRuleLimits.maxNestingDepth}.\n`;
}

export function skillRules(projectType: string): string {
	return `# Harness Project Discipline\n\nUse this skill whenever you are planning, implementing, reviewing, or verifying code in this Harness ${projectType}.\n\n## Operating Rules\n\n1. Treat \`harness info\`, Harness generators, and \`harness audit\` as mandatory project controls.\n2. Run \`harness info <topic>\` or \`harness info scaffolds --json\` before creating unfamiliar code shapes.\n3. For non-trivial work, ask what the loop should prove, search templates, then create or continue a \`harness loop\`.\n4. Prefer \`harness generate <kind> <name>\` for supported scaffolds, then adapt the generated file within Harness limits.\n5. Add or update the feature spec first so the intended behavior is explicit before implementation.\n6. Keep generated and hand-edited files inside the configured Harness rule limits.\n7. Use \`harness info clean-code\` for optional Jev review; preview coverage before enabling it, use a project-owned credential, and assess advisory results before gating.\n8. Verify with \`bun run check\` before handing work back.\n\n${regressionLoopRules()}\n## Hard Limits\n\n- Files: ${harnessRuleLimits.maxFileLines} lines.\n- Functions: ${harnessRuleLimits.maxFunctionLines} lines.\n- Classes: ${harnessRuleLimits.maxClassLines} lines.\n- Methods: ${harnessRuleLimits.maxMethodLines} lines.\n- Nesting: ${harnessRuleLimits.maxNestingDepth} levels.\n- Parameters: ${harnessRuleLimits.maxParameters}.\n- Classes per file: ${harnessRuleLimits.maxClassesPerFile}.\n`;
}

function regressionLoopRules(): string {
	return `## Callable usage examples

- Every public helper needs committed usage examples in its callable contract: a real call, argument values, and expected output or error. Verify examples against the implementation; never invent outcomes.
- Run \`harness units check\`: missing helper examples must fail. Re-indexing must preserve authored examples. Each helper detail page shows only its own examples at the viewed commit.

## Bug and Regression Loops

${bugRepairPolicy()
	.map((rule) => `- ${rule}`)
	.join('\n')}
- Use \`harness loop create <name> --from bug-fix --goal <text>\` for bug repairs: reproduce with a failing test before implementation, then repeat repair and the same unchanged test until it passes.
- Use \`--from regression-prevention\` for regressions requiring durable prevention: identify the root cause, propose the repair and guard, implement both, and include the guard in normal project verification.
- Prove the guard rejects reintroducing the original failure in an isolated fixture or temporary workspace; restore the repair and prove the guard passes.
- Record failing and passing commands, assertions, and results as step evidence. Keep green/guard/verification steps pending while proof fails; the agent retries repairs and checks. Harness does not launch an AI repair runner or automatically complete steps.
- For affected UI paths, exercise the browser flow and capture fresh screenshots, then inspect the images before recording proof. Report blockers without claiming completion.
- Browser normal flows, including screenshot/video runs, must have no unexpected console.error or pageerror events. Use the shared browserTest fixture; watch extra contexts before navigation. Keep logs for expected errors and declare their exact messages and reasons in that test. For unexpected errors, prove a failing log assertion before repair, then rerun the same unchanged regression until the error disappears; preserve diagnostics and keep verification pending while errors remain.
- Shared browser fixtures must preserve lazy setup. When their dependencies change, prove API-only tests run with an unavailable browser executable alongside actual browser cases.
`;
}
