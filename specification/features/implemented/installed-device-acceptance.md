---
status: implemented
shippedIn: null
unitIds:
  [
    'script.check-installed-device-proof',
    'service.projects-sessions-tracker-native-runtime-service-tracker-done-proof-rule'
  ]
owner: Chief of Staff
reviewedAt: null
---

# Feature: Installed device acceptance

## Overview

Review native onboarding, device linking and approval, and changes to their permissions against the experience people get in the signed, installed product. In w1yjzn, signed Mac sign-in, a synthetic simulator callback and TestFlight availability were grouped into closeout even though the physical iPhone had not completed the flow. The release needs its own evidence for each affected shipped surface.

## Acceptance Criteria

- At spec review, name each affected shipped surface and its starting state, signed installed build identity to read back, expected approval and host (if required), first meaningful in-app action, authoritative success readback, proof owner and release boundary. Keep an installed-path milestone for this acceptance.
- At verification, exercise one focused run per affected surface. Use supported setup, a real Google return, required approval and the normal in-app action. For iPhone use a physical iPhone and the actual paired or approving host when relevant. Preserve existing sessions and the release approval boundary.
- For zgfvhk, start with a newly signed-in physical iPhone, approve it on the primary Mac, show a labeled Needs you item, tap an answer in the iPhone app, read the matching answer from authoritative Tracker, and clean up the canary item. Reuse the [Needs you release canary](https://github.com/dafuga/harness/pull/408) for the action, readback and cleanup where covered.
- Keep the installed path pending or blocked if a hop is missing. Record the exact missing hop and link the open acceptance from any source-only closeout. Simulators, TestFlight availability, synthetic callbacks, copied public keys, launch settings, injected sessions or grants, prelinked state and direct answers that bypass the app can be recorded as partial observations only.
- Attach one versioned record to the feature or release Tracker item. The guard rejects incomplete evidence for any expected surface and accepts a complete record. Native generated and recovery briefs and the CoS hand-launched brief carry the same rule.

## Future Enhancements

The product implementation and physical acceptance remain on zgfvhk and release 0j8kry.

## Proof record v1

Use stable lowercase surface names such as `mac` and `iphone`. Copy the release boundary and required surface names from the approved scope independently of the record. Enter one plan and observation per surface in `surfaces`.

```json
{
	"schemaVersion": 1,
	"releaseBoundary": "example-release@approved-sha",
	"surfaces": {
		"iphone": {
			"entryState": "Installed and signed out with no device link",
			"expectedBuild": "example-ios-build",
			"approvalHost": "Primary Mac",
			"firstAction": "Tap Canary C on the labeled Needs you item",
			"authoritativeSource": "Tracker",
			"expectedResult": "Canary C recorded for the matching item and iPhone actor",
			"owner": "Release verifier",
			"proof": {
				"status": "blocked",
				"missingHop": "Real Google return on the signed installed iPhone",
				"observations": "TestFlight availability verified. Physical return pending."
			}
		}
	}
}
```

Set `approvalHost` to `null` only if the reviewed flow requires no host approval. Use a nonsecret device label. On completion, replace `proof` with observed details in this shape. Keep evidence references for the installed build, Google return and host approval with the run, and link them from the attached record or Tracker note.

```json
{
	"status": "passed",
	"device": "Physical acceptance iPhone",
	"target": "physical-device",
	"installedBuild": "example-ios-build",
	"signature": "verified",
	"setup": "supported-from-entry-state",
	"googleReturn": "real",
	"approvedOn": "Primary Mac",
	"action": { "via": "installed-app", "evidence": "Observed tap on canary item EXAMPLE" },
	"readback": {
		"source": "Tracker",
		"result": "Canary C recorded for the matching item and iPhone actor",
		"evidence": "Tracker readback for EXAMPLE matched the selected option and expected actor"
	},
	"cleanup": "Confirmed EXAMPLE was cleaned up"
}
```

Run the check from a Harness source checkout using the boundary and surfaces approved at spec or release review. Use exit 0 as a record completeness check and review the cited observations before accepting the installed path. Exit 1 reports pending evidence. Exit 2 means the input could not be read or the invocation was incomplete.

```sh
bun scripts/check-installed-device-proof.ts proof.json example-release@approved-sha iphone
```

Attach the record on the feature or release item, for example as the JSON text in a Tracker build artifact's `summary`. If that slot already holds planning evidence, preserve it and link a version-pinned record from it or from a Tracker note. Read the attachment back with `tracker show <id> --json`. A blocked record documents current progress and is updated with the real run when it becomes available.
