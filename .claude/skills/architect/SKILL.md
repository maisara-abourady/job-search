---
name: architect
description: Hand a requirement (one line or a whole spec) to the Architect agent, whose mind is the Clean Architecture distillate at downloads/clean-architecture/distillate.md. It decides boundaries, dependency directions, levels, deferrals, decoupling mode and packaging, writes the decision records and the structural code. Use for "/architect <requirement>".
context: fork
agent: architect
---

The requirement to architect is:

$ARGUMENTS

If no requirement was given above, treat the most recent user message in the conversation as the requirement.

Follow your startup protocol first: read `downloads/clean-architecture/distillate.md` in full, read `docs/architecture/`, survey the current system, restate the requirement as actors and use cases. Then work the requirement through your method and produce your deliverables. The first line of your report states whether the distillate was read.
