# Installed Harness test policy

The installed Harness project skill now specifies only the five entity test forms,
finite state/prop/error matrices, stable case counts, authored expectations,
complete API comparisons, reviewed visual baselines and revision-bound artifacts.
The shared regression skill routes Harness work through that policy and explicitly
keeps multiple issue repairs inside existing cases. Other projects keep their
existing workflow. No external application suite was migrated.

Static validation passed for both skill frontmatters and instruction structure
using the skill-creator validator with isolated PyYAML 6.0.2. This is instruction
validation, not application test execution or completed migration proof.

Installed file hashes at 2026-10-26T01:02:22.605107+00:00:

- `/Users/danielfugere/.codex/skills/harness-project/SKILL.md`
  SHA-256: `3adb8a1d96848a21bed40ef313ec3000e139d0d61668aa558072aadffddde222`.
- `/Users/danielfugere/.codex/skills/regression-first-issue-fixing/SKILL.md`
  SHA-256: `680bc827d899efd8655ab0ba9e4b9f22de987016049157e1dab6acf1e1653516`.

The installed policies also require explicit states and make prop/error additions
strengthen existing rows. Only a distinct declared state, Example or method adds a
row. Static validation was rerun after this alignment.
