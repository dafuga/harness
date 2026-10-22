# AgentActivityService examples

Authored usage of `service.agent-activity`, committed with its source. These are expected uses, not test results.

- Class: `src/services/agents-providers/agent-activity-service/AgentActivityService.ts`.
- Consumers: `src/workflows/projects-sessions/runActivity.ts` creates it for `registerAgent`, `beatAgent`, `beatFromEnvironment`, `finishAgent` and `listAgents`; `ProjectActivityService.show` reads its `roster` into `live.agents`.
- Placeholders: generated ids and times, the default allowance from `agentStatement` and the state and detail from `agentLiveness` are named in angle brackets. Their rules are not restated here.
- Not documented: registering with `pid`, `ttl`, `provider`, `model` or `loop`, and a roster with damaged registrations.

```harness-examples
{
	"schemaVersion": 1,
	"unitId": "service.agent-activity",
	"setup": "// As runActivity.ts creates it; ProjectActivityService.show passes its own root and checkouts.\nconst root = await activityRoot();\nconst checkouts = await new ProjectWorkRepository(root).checkouts();\nconst agents = new AgentActivityService(root, checkouts);",
	"examples": [
		{
			"name": "Register an agent before it starts work",
			"description": "registerAgent in runActivity.ts passes the command's options here and reports id, branch, registeredAt and ttlSeconds from the result. Registering also removes this checkout's registrations that said nothing for a week.",
			"call": "await agents.register({ label: \"codex\", task: \"Document service examples\", units: \"service.agent-activity\" })",
			"input": {
				"label": "codex",
				"task": "Document service examples",
				"units": "service.agent-activity"
			},
			"output": {
				"registration": {
					"schemaVersion": 1,
					"id": "<generated UUID>",
					"label": "codex",
					"provider": null,
					"model": null,
					"pid": null,
					"processStartedAt": null,
					"registeredAt": "<ISO time of the call>",
					"ttlSeconds": "<default ttlSeconds from agentStatement>"
				},
				"beat": {
					"at": "<ISO time of the call>",
					"branch": "<branch of the root checkout, or null>",
					"task": "Document service examples",
					"loop": null,
					"units": ["service.agent-activity"]
				},
				"end": null
			}
		},
		{
			"name": "Refuse a registration that does not say who the agent is",
			"description": "The label is checked before anything is written.",
			"call": "await agents.register({ task: \"Document service examples\" })",
			"input": { "task": "Document service examples" },
			"error": { "name": "ExpectedCliError", "message": "--label must say who the agent is." }
		},
		{
			"name": "Restate the task with a heartbeat",
			"description": "What is restated replaces what was said; loop and units keep their registered values.",
			"call": "// agentId: registration.id of the agent registered above.\nawait agents.heartbeat(agentId, { task: \"Add browser assertions\" })",
			"input": ["<agentId>", { "task": "Add browser assertions" }],
			"output": {
				"at": "<ISO time of the call>",
				"branch": "<branch of the checkout holding agentId, or null>",
				"task": "Add browser assertions",
				"loop": null,
				"units": ["service.agent-activity"]
			}
		},
		{
			"name": "Mark work without restating anything",
			"description": "beatFromEnvironment in runActivity.ts sends this when HARNESS_AGENT_ID is set and ignores any error, so the command it follows never fails.",
			"call": "await agents.heartbeat(agentId, {})",
			"input": ["<agentId>", {}],
			"output": {
				"at": "<ISO time of the call>",
				"branch": "<branch of the checkout holding agentId, or null>",
				"task": "Add browser assertions",
				"loop": null,
				"units": ["service.agent-activity"]
			}
		},
		{
			"name": "Refuse a heartbeat for an agent the repository does not hold",
			"description": "Every checkout of the repository is searched. An id with characters other than letters, digits, _, . or - is refused the same way.",
			"call": "await agents.heartbeat(\"unknown-agent\", {})",
			"input": ["unknown-agent", {}],
			"error": {
				"name": "ExpectedCliError",
				"message": "unknown-agent is not registered in this repository."
			}
		},
		{
			"name": "List the agents of the repository, working ones first",
			"description": "listAgents in runActivity.ts returns this for renderRoster. Entries sort by state (working, stale, gone, failed, completed), then newest heartbeat; others stay listed for a day after their last word. Shown with no damaged registrations and no other recent agent; service.agent-activity is in this registry, so no unit is unknown.",
			"call": "// While the agent registered above is still working.\nawait agents.roster()",
			"input": [],
			"output": {
				"tracking": "available",
				"working": "<count of working entries>",
				"unreadable": 0,
				"roster": [
					{
						"id": "<agentId>",
						"label": "codex",
						"provider": null,
						"model": null,
						"registeredAt": "<ISO time of the registration>",
						"worktree": "<directory name of the checkout>",
						"branch": "<branch of the latest heartbeat, or null>",
						"task": "Add browser assertions",
						"loop": null,
						"units": ["service.agent-activity"],
						"unknownUnits": [],
						"heartbeatAt": "<ISO time of the latest heartbeat>",
						"expiresAt": "<heartbeatAt plus ttlSeconds>",
						"state": "<state from agentLiveness>",
						"detail": "<detail from agentLiveness>"
					}
				]
			}
		},
		{
			"name": "List agents where none ever registered",
			"description": "When no checkout's registry has been used, how many agents are working is not known. renderRoster then says no agent has registered in this repository.",
			"call": "// otherRoot, otherCheckouts: a repository where no agent ever registered.\nawait new AgentActivityService(otherRoot, otherCheckouts).roster()",
			"input": [],
			"output": { "tracking": "never-used", "working": null, "unreadable": 0, "roster": [] }
		},
		{
			"name": "Finish with an outcome",
			"description": "finishAgent in runActivity.ts passes failed as true to record failed instead of completed. The end is written once.",
			"call": "// Resolves with no value, shown as null.\nawait agents.finish(agentId, false, \"Service examples documented\")",
			"input": ["<agentId>", false, "Service examples documented"],
			"output": null
		},
		{
			"name": "Refuse to finish an agent that has ended",
			"description": "Heartbeats are refused the same way; the agent registers again to go on working.",
			"call": "await agents.finish(agentId, true)",
			"input": ["<agentId>", true],
			"error": {
				"name": "ExpectedCliError",
				"message": "<agentId> has finished; register again to go on working."
			}
		}
	]
}
```
