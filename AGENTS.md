# DoorDrop — agent instructions (Codex)

Read `CLAUDE.md` for the full agent guide: product shape, architecture, and how to add features and deploy.

## Delivery mode

**Straight to `main`. No branches, no pull requests.** Declared 2026-08-16.

- Commit small and often, directly to `main`.
- Hard rule: do not run `git checkout -b`, `git switch -c`, or `gh pr create`.
- If you find yourself on a non-`main` branch, stop and report it.
- Use a closing keyword (e.g. `closes #N`) in the commit message of any commit that resolves an issue.
- The old ticket-only mode (file issues, never change app code) is revoked. Fix the problems you find, within the rules above.
