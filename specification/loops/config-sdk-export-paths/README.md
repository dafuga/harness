# Config export prevention

- Incident evidence: `d92da812` moved config generation to `configs/` but left the existing SDK export plan under `config/`. Main PR #75's all-scaffolds parity assertion exposed the omission before PR #79 landed.
- Process failure: relocation review checked emitted paths and import edits without comparing the generator's separate public export plan. The old generated-library test accepted an export string without proving that its target existed.
- Durable control: every config relocation now invokes the existing `test/pieces.test.ts` export-to-emission matrix. Local AGENTS, the Harness skill and generated tenant guidance name this checkpoint. The existing generated-library test also reads the exact config source named by its SDK export.
- Proof: test-first source `755c49710` fails; source `ffc5c6889` passes the same command and complete frozen test corpus. Records `40a9d1e2` and `afb8f74c` retain the paired evidence and generator workloads.
- Cost: reuse existing generator and library tests; no additional workflow or broad suite. Full CLI and native suites remain deferred by Daniel.
