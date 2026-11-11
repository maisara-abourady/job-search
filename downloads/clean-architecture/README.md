# Clean Architecture distillate

Place the book distillate at `downloads/clean-architecture/distillate.md`.

The `architect` agent (`.claude/agents/architect.md`) reads that file in full at the
start of every invocation and treats it as the authoritative statement of its
knowledge. Until the file is present, the agent reports that it is missing and
falls back on the compressed version of the book embedded in its definition.
