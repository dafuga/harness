// @harness-uid u_xhlm4envoy
/** The mock-mode skill checklist carried by planner prompts and worker briefs. */
export const mockModePlanningRule: string =
	'When planning app work, use the `mock-mode` skill. Estimate the time and money for one real end-to-end test and record the estimate in the plan. ' +
	'If it costs money or takes more than about one minute, make “Mock mode first” a task before feature work. Extend any existing mock mode for the change. ' +
	'Require one local/test switch, a production guard with an automated test, and mock adapters behind the existing provider interfaces. ' +
	'Plan deterministic, network-free fixtures for success and failure cases, a visible MOCK badge in apps with a UI, MOCK in logs, and an automated test proving zero paid calls in mock mode. ' +
	'Name the tests and evidence runs that use mock mode by default, the one real-path release check behind an explicit flag and spend cap, and who refreshes fixtures when the real API changes. ' +
	'Carry the applicable checklist into module-job and launch briefs and name the `mock-mode` skill.';
