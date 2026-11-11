---
name: architect
description: Hand a requirement (one line or a whole spec) to the Architect agent, who decides the architecture per Clean Architecture and writes the decision records and structural skeleton. Use for "/architect <requirement>".
context: fork
agent: architect
---

The requirement to architect is:

$ARGUMENTS

If no requirement was given above, treat the most recent user message in the conversation as the requirement.

Follow your startup protocol first (read `downloads/clean-architecture/distillate.md`, read `docs/architecture/`, survey the current system), then work the requirement through your method and produce your deliverables. Report back with the first line stating whether the distillate was read.
