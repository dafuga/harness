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

The function returns a labeling function. The examples evaluate it for the example agent and show the resulting `labels` array. Inputs below describe the usage scenario in seconds; they are not a serialized AgentRoster.

## Usage

Use a fixed sample time and construct a roster with one agent. Set its state to `agentState`, its expiry to the sample time plus `agentAllowanceSeconds`, and the roster's working count to `reportedWorking`. Call `activityReading(agents, sampledAt, sampleTime + sampleAgeSeconds * 1000)`.

The documented values are expected behavior. Automated checks run these same scenarios; only attached verification records say a particular revision passed.

## Examples

```harness-examples
{
  "schemaVersion": 1,
  "unitId": "reports.function.activity-reading",
  "examples": [
    {
      "name": "A fresh roster still shows the agent working",
      "description": "The roster is 5 seconds old and the agent has 5 seconds left.",
      "input": {
        "sampleAgeSeconds": 5,
        "agentAllowanceSeconds": 10,
        "reportedWorking": 1,
        "agentState": "working"
      },
      "output": {
        "current": true,
        "working": 1,
        "labels": [
          "Working"
        ]
      }
    },
    {
      "name": "An expired agent stops counting as working",
      "description": "The roster is fresh, but the agent missed its own heartbeat allowance.",
      "input": {
        "sampleAgeSeconds": 30,
        "agentAllowanceSeconds": 10,
        "reportedWorking": 1,
        "agentState": "working"
      },
      "output": {
        "current": true,
        "working": 0,
        "labels": [
          "Stale"
        ]
      }
    },
    {
      "name": "An old roster cannot confirm who is working",
      "description": "After one minute the roster cannot provide a current working count.",
      "input": {
        "sampleAgeSeconds": 61,
        "agentAllowanceSeconds": 120,
        "reportedWorking": 1,
        "agentState": "working"
      },
      "output": {
        "current": false,
        "working": null,
        "labels": [
          "Not confirmed"
        ]
      }
    },
    {
      "name": "A finished agent keeps its recorded outcome",
      "description": "A completed outcome remains Finished even when the roster is old.",
      "input": {
        "sampleAgeSeconds": 61,
        "agentAllowanceSeconds": 120,
        "reportedWorking": 0,
        "agentState": "completed"
      },
      "output": {
        "current": false,
        "working": null,
        "labels": [
          "Finished"
        ]
      }
    }
  ]
}
```
