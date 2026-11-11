---
name: implementation-planning
description: Hand an approved architecture (normally the Architect's output under docs/architecture/) to the Implementation Planner agent, which turns it into an executable, phase-by-phase build plan under docs/implementation-plan/ that Claude Code can execute across many sessions - walking skeleton first, vertical slices built inside-out, risk retired early, boundary enforcement in tooling, every task with files, acceptance criteria and a verify command, and a gate at every phase. Use for "/implementation-planning [scope or instructions]", and whenever the user says "plan the implementation", "break this into phases", "what do we build first", "create a build plan", "task breakdown", "turn the architecture into tasks", or wants to resume, amend or continue executing an existing plan.
context: fork
agent: implementation-planner
---

The planning request is:

$ARGUMENTS

If no request was given above, treat the most recent user message in the conversation as the request. If that message gives no specific scope, plan the build of everything in `docs/architecture/`.

Follow your startup protocol first: read `references/templates.md` and `references/example.md` under `.claude/skills/implementation-planning/`, read `docs/architecture/` in full, read any existing `docs/implementation-plan/`, survey the repository, and decide whether this is plan mode or execute mode. If no architecture exists, stop and recommend `/architect`. The first line of your report states whether the references and the architecture were read.
