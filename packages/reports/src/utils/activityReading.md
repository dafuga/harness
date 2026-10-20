# Activity freshness

Determines which registered agents a sampled roster can still describe as working.

## Contract

| Input     | Type        | Meaning                                           |
| --------- | ----------- | ------------------------------------------------- |
| agents    | AgentRoster | Agent entries and the working count when sampled. |
| sampledAt | string      | ISO timestamp of the roster sample.               |
| now       | number      | Current Unix time in milliseconds.                |

| Output       | Type           | Meaning                                                            |
| ------------ | -------------- | ------------------------------------------------------------------ |
| current      | boolean        | Whether the roster is at most 60 seconds old.                      |
| working      | number or null | Working count after expired agents are removed; null when unknown. |
| label(agent) | string         | Working, Stale, Not confirmed or the recorded final state.         |

## Examples

```harness-examples
{
  "schemaVersion": 1,
  "unitId": "reports.function.activity-reading",
  "examples": [
    {
      "name": "Fresh sample",
      "input": {
        "sampleAgeSeconds": 5
      },
      "call": "activityReading(\n  { tracking: \"available\", working: 0, unreadable: 0, roster: [] },\n  \"2026-10-11T12:00:00Z\",\n  Date.parse(\"2026-10-11T12:00:05Z\")\n).current",
      "output": true
    },
    {
      "name": "Expired sample",
      "input": {
        "sampleAgeSeconds": 61
      },
      "call": "activityReading(\n  { tracking: \"available\", working: 0, unreadable: 0, roster: [] },\n  \"2026-10-11T12:00:00Z\",\n  Date.parse(\"2026-10-11T12:01:01Z\")\n).current",
      "output": false
    },
    {
      "name": "Unknown working count",
      "input": {
        "sampleAgeSeconds": 61
      },
      "call": "activityReading(\n  { tracking: \"available\", working: 0, unreadable: 0, roster: [] },\n  \"2026-10-11T12:00:00Z\",\n  Date.parse(\"2026-10-11T12:01:01Z\")\n).working",
      "output": null
    }
  ]
}
```
