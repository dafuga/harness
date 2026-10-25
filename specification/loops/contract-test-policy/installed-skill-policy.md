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

Installed file hashes at 2026-10-25T23:35:01.795851+00:00:

- `/Users/danielfugere/.codex/skills/harness-project/SKILL.md`
  SHA-256: `12633e35ada7e991eb79f439d2c72984ca2c8106b89e3ffcb7bde569c3f25d10`.
- `/Users/danielfugere/.codex/skills/regression-first-issue-fixing/SKILL.md`
  SHA-256: `77df59b0d1ecb69af38832e678a9ec77d23c10818eab2b58a8f10758cd4681f2`.
