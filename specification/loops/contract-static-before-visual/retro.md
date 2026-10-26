# Process prevention retro

- Incident: `4d1a5f87e4` inserted required browser tests before audit and disabled automatic baseline creation. A fresh app could stop at missing baselines, hiding valid static audit diagnostics. The aggregate at `d26e0fdbea` exposed it in the existing ecosystem-adapter case; no release is claimed.
- Process failure: the generator case checked that audit existed, without asserting gate order. Earlier focused work did not include the real static-violation boundary when making browser admission mandatory.
- Primary prevention: whenever adding a required gate, strengthen the existing generator-order case and real CLI static-violation case. The generated agent rules and repository Harness skill now require this checkpoint. The guard checks static admission before any browser baseline decision and retains all original cases.
- Observable proof: unchanged seven-case matrix fails at `9be2073cee` and passes at `bebb9c6d2b`, in matched Harness records `d5c6e9480573` and `dd6161784252`. No baseline is accepted, no test is added, and no compiler, lint, audit, unit, browser or build gate is removed.
- Cost: a small ordering assertion in a case already run, plus existing disposable CLI integration. A deliberate old-order mutation must fail that same matrix before the guard step is complete.
