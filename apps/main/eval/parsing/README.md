# Parsing evaluation (P1-T11, the Phase 1 exit test)

`pnpm eval parsing` runs `IntakeResume` with the real `LibraryDocumentReader` and the Claude Code `ResumeAnalyst`
on every PDF in `apps/main/eval/fixtures/private/resumes/` and compares each saved profile with its expected file.
`pnpm eval parsing --only=resume-03` runs one. It calls the owner's Claude Code, so it needs the same local
configuration as the app (`MATCHMAKER_MODEL_TRAINING_OFF_CONFIRMED`; see `apps/main/src/config.ts`).

## Fixtures (never committed)

`fixtures/private/` is gitignored. It holds consented real resumes (H-3) and nothing else:

```
fixtures/private/resumes/
  resume-01.pdf
  resume-01.expected.json
  ...
```

Files are numbered, not named after people. Reports go to `apps/main/eval/results/` (also gitignored) because
they quote titles, employers and skills.

## Expected-file schema

```json
{
  "id": "resume-01",
  "roles": [
    { "employers": ["As written", "Accepted variant"], "titles": ["As written", "Accepted variant"],
      "start": "2022-03", "end": null, "optional": false }
  ],
  "skills": { "required": ["Node.js|NodeJS"], "optional": ["Microservices"] }
}
```

- **Roles.** Every non-optional expected role must match one parsed role exactly, and no parsed role may be left
  over. Employer and title match after normalizing case, punctuation, "&"/"and" and legal suffixes (Company, GmbH,
  ...) against any listed variant. `start`/`end` are `YYYY-MM`; a bare `YYYY` (the resume gives only the year)
  matches any month of that year; `end: null` is a current role. `optional: true` marks a role a parser may include
  or leave out (an extracurricular post).
- **Skills.** `required` are the tools, technologies and named methods the resume lists in a skills section or
  names in its lines. Recall is measured on them. `optional` are further names a careful reader could reasonably
  extract (soft competencies, domains, patterns). A parsed skill counts toward precision if it matches either list.
  `"A|B"` lists accepted spellings; names match when equal after dropping case, spaces, punctuation and a plural "s".
- **Thresholds (H-4, accepted):** every role exact; skills recall and precision at least 0.9 per resume. The report
  also shows the median and maximum seconds from upload to card (target under 20).

## Adding a resume

1. Get the person's consent (PRD Privacy 5) and put the PDF in `fixtures/private/resumes/` as the next
   `resume-NN.pdf`.
2. Write `resume-NN.expected.json` by reading the resume yourself. Never generate it with the analyst under test.
3. Have the owner review it, then run `pnpm eval parsing --only=resume-NN`.
