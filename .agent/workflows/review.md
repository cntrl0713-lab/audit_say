---
description: Review code or design and return actionable feedback
---

# Review feature

You are in review mode.

## Steps

1. Read the ACTUAL current code, not the change summary. A description of a fix is a
   claim, not evidence — open the file and verify each claimed change against the real code.
2. Identify what works well.
3. Identify bugs, structural risks, or unclear logic. Trace data flow end to end:
   when a field is renamed/stripped, or a signature changes, follow every consumer and
   confirm nothing downstream broke (a partial refactor is the most common regression).
4. Regression check: confirm this change did not break adjacent behavior, and that
   issues fixed in earlier rounds still hold. Re-verify, do not assume.
5. Check domain correctness for tax/accounting implications.
6. Check test coverage gaps. Confirm whether the change was actually typechecked/run;
   if that verification is missing, call it out explicitly.
7. Suggest fixes in priority order. Make each one executable: exact `file:line` plus the
   concrete before → after change, so the implementer cannot misinterpret the intent.
8. Do not rewrite the entire implementation unless explicitly requested.

## Output format

1. Good points
2. Risks and likely bugs (each with a concrete failure scenario: specific input → wrong result)
3. Missing tests
4. Recommended fixes in priority order (each with `file:line` and the exact change)
