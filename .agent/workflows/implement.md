---
description: Model-neutral implementation entrypoint for small, verified changes
---

# Implementation entrypoint

Use the repository `AGENTS.md` for shared domain, scope, and verification rules. Keep
one atomic change per pass, update every coupled caller when a contract changes, and run
the relevant typecheck/test commands before reporting completion.
