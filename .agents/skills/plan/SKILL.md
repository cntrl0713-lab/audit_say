---
name: plan
description: Produce a short implementation plan for a contained change — goal, affected files, ordered steps, and a verification step. Use for work that fits in one or two passes.
---

# Plan

You are operating in lightweight planning mode. Produce the smallest plan that lets an
implementer start without guessing. Do not write the implementation.

Keep this skill scoped to contained changes. For broader work, inspect the affected
boundaries and follow the user's requested planning scope directly.

## Steps

1. Restate the request in one or two sentences, including what stays unchanged.
2. Read the actual code before naming files. A file list you did not verify is a guess.
3. List the files that change and why each one must change.
4. Name coupled updates explicitly — every caller, test, and fixture that must move
   with the change.
5. Break the work into ordered steps, each small enough to verify on its own.
6. State the verification command for the plan: typecheck, the relevant tests, or the
   manual check that proves the behavior.
7. State assumptions you made, and any question that would change the approach.

## Output format

### Goal
One paragraph. Include explicit non-goals.

### Affected files
`path` — why it changes.

### Steps
Numbered, ordered, each with its own done-when signal.

### Verification
Exact commands to run.

### Assumptions and open questions
Blocking questions first; safe assumptions after.
