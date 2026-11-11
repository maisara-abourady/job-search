# PRD: AI Job Matchmaker

Nov 11, 2026 · @Maisara · Revised Nov 11, 2026: personal, local-only tool

> **Scope revision.** This is not a product. It runs locally on the owner's machine, is operated by the owner for themselves and a few friends, and is never hosted, sold or monetized. There are no accounts, trial, billing or paywall. Everything below has been rectified to match; the change log is at the end.

## Summary

The product reads a resume, runs a short AI interview, searches every reachable job source, and tells the job seeker which jobs to apply to, what to emphasize in each application, and exactly why every other job is not a fit.

It is a personal web app that runs locally on the owner's machine, for any role, worldwide, in English. The owner uses it for their own search and keeps a separate profile for each friend they help. An agent built on Claude Code runs the searches. Each strong match comes with a resume tailored for that job's ATS.

The north-star metric is time to first strong match: the minutes between creating a profile and the first Apply verdict on screen. The proposed target is a median under 10 minutes.

The working name is AI Job Matchmaker. Items marked "assumption" were not covered in the interview and need your confirmation.

## Decisions from the interview

These answers are fixed inputs to everything below. Rows marked *revised* were changed by the scope revision.

| Area | Decision |
| --- | --- |
| Audience | The owner and a few friends; not a product *(revised)* |
| Form | Web app running locally on the owner's machine, with a Claude Code agent *(revised)* |
| Segment | Any role, global |
| Claude Code's role | Builds the product and runs searches at runtime |
| Discovery | On demand and continuous background monitoring |
| Beyond matching | Tailored resume per job |
| Onboarding inputs | Resume, preferences, and an AI interview |
| Sources | Official APIs, ATS feeds, paid aggregators, and direct scraping |
| Result display | Verdict plus expandable score breakdown |
| Unqualified jobs | Separate Not a fit tab with reasons |
| Tailoring depth | Aggressive ATS keyword optimization |
| Missing keywords | Ask the user to confirm they have it, then add |
| Alerts | In-app only |
| Profiles | One profile per person, managed by the owner; no sign-up or login *(revised)* |
| Pricing | None: never monetized; the owner pays their own model and aggregator costs *(revised)* |
| Languages | English only |
| Learning from behaviour | None in v1 |
| Hard dealbreakers | Work authorization and seniority level |
| Verdict strictness | Strict, with a clear shape for encouragement |
| North star | Time to first strong match |

## Users and jobs to be done

The operator is the owner, who installs and runs the app on their own machine and creates a profile for each person they help. Each person served is an active job seeker who is applying now and wastes hours reading postings they will never win, or a passive seeker who wants the app to watch the market for them. The owner reviews results with the friend or sends them the tailored resume.

| The user wants | The product answers with |
| --- | --- |
| Tell me which jobs to apply to | A short Apply list, ranked |
| Tell me what to emphasize | Three points to capitalize on per job, tied to resume evidence |
| Tell me why not | A detailed report for every rejected job |
| Get me past the ATS | A tailored resume per job with keyword coverage before and after |
| Show me what I am really selling | A selling-points card built from the resume and interview |
| Keep watching for me | Background monitoring with an in-app inbox |
| Tell me what to fix | The most common gaps across all rejected jobs |

## Experience principles

Every screen asks for one decision at most, and the product never asks what it can infer.

1. Verdict first. The user sees Apply, Stretch, or Not a fit before any number.
2. Evidence on demand. Scores and breakdowns sit one tap away, never in the default view.
3. One sentence per verdict. Every job carries a plain-language reason a tired person can read in three seconds.
4. No settings pages. Defaults are fixed in v1; the only inputs are the resume, four preferences, and the interview.
5. Work starts before the user finishes. Searching begins as soon as the resume parses, so results are waiting when onboarding ends.
6. Results stream. The first matches appear while the rest are still scoring.
7. Rejection teaches. Every Not a fit report ends with what would change the verdict.
8. Nothing is invented. A claim enters a resume only if the source resume or the user's confirmation supports it.

## User flows

There are eight flows. The first three form the path to the north-star moment. "The user" below means the owner, acting for whichever person's profile is open.

### Flow 1: Onboarding

1. The owner opens the app on their machine, creates or selects a person's profile, and drops that person's resume: PDF, DOCX, pasted text, or a LinkedIn profile PDF export.
2. The product parses it and shows a selling-points card: "Here is what you are selling." The user can correct any line.
3. The background search starts now, using the parsed resume alone.
4. The user answers four preference screens, one tap each: location and work mode, work authorization, target seniority, and salary floor (optional).
5. The AI interview asks 5 to 7 adaptive questions to surface strengths the resume hides. Each question is skippable and the whole interview can be ended at any point.
6. The profile is final. Jobs already fetched are scored against the full profile.

### Flow 2: First results

1. Results stream into three tabs: Apply, Stretch, and Not a fit, each with a count.
2. The Apply tab opens by default, ranked by priority.
3. Each card shows the title, company, location, verdict, and a one-sentence reason.
4. If the Apply tab is empty, the product shows the three closest jobs and the single change that would move each to Apply.

### Flow 3: Job detail

1. The user opens a card and sees the verdict and reason at the top.
2. Below sit three points to capitalize on, each linked to the resume evidence behind it.
3. Gaps are listed next, each marked as closable or not.
4. The score breakdown is collapsed. Expanding it shows every sub-score and the requirement-by-requirement table.
5. Four actions are available: Tailor resume, Open posting, Mark applied, and Dismiss.

### Flow 4: Tailoring a resume

1. The user taps Tailor resume.
2. If the job demands keywords the resume lacks, the product shows them as chips: "Do you have these?" The user taps Have it or Don't have it.
3. For each Have it, the user adds one line on where they used it. Confirmed keywords are saved to the profile and never asked again.
4. The product generates the resume and shows keyword coverage before and after, with a diff against the original.
5. The user downloads PDF or DOCX.

### Flow 5: Reviewing Not a fit

1. The tab opens with a summary: how many jobs were rejected and for which reasons.
2. A gap insight sits at the top: the requirements most often missing across all rejected jobs.
3. Jobs are grouped by primary reason. Each opens to a full report.
4. If a report rests on a wrong fact, the user taps Fix a fact, corrects the profile, and all affected jobs are re-scored.

### Flow 6: Monitoring

1. Monitoring is on by default after the first search.
2. The agent re-runs searches on a schedule and scores only new jobs. Scheduled runs happen only while the app is running on the owner's machine; a run that was missed while it was off happens at the next start.
3. On the next visit an in-app inbox shows new Apply and Stretch matches since the last session.
4. The user can trigger a fresh search manually at any time.

### Flow 7: Updating the profile

1. The user uploads a new resume or edits a fact, preference, or interview answer.
2. All stored jobs are re-scored. Verdicts that changed are flagged.

### Flow 8: Managing profiles

1. The owner sees a list of profiles (themselves and each friend) and switches between them; each profile's results, inbox and tailored resumes are separate.
2. The owner can export a profile's data or delete a profile entirely, for example when a friend asks.
3. A running-cost panel shows model and aggregator spend per profile and per month.

### Edge cases

| Case | Behaviour |
| --- | --- |
| Resume cannot be parsed (scanned image, corrupt file) | Run OCR; if that fails, ask for pasted text |
| Resume is not in English | Explain the v1 limit and stop |
| No work history (new graduate) | Interview shifts to projects, education, and volunteering; seniority defaults to entry |
| Career changer | Interview asks for the target field; transferable evidence is scored as partial |
| Job post is thin or vague | Scored with low confidence and tagged as a thin posting |
| Job post gives no authorization information | Gate result is Unknown; the job passes with a flag |
| Same job on several sources | Merged into one record that keeps every source link |
| Job expires after it was matched | Marked closed and removed from Apply and Stretch |
| A source is down or blocked | The run continues; the run summary names the missing source |
| Search returns very few jobs | The agent widens to adjacent titles and tells the user it did |

## Functional requirements

There are 53 requirements across nine areas. P0 is required for the first usable version; P1 follows after it.

### Resume intake and profile

| ID | Requirement | Priority |
| --- | --- | --- |
| RP-1 | Accept PDF, DOCX, pasted text, and LinkedIn PDF exports up to 10 MB | P0 |
| RP-2 | Extract roles, employers, dates, achievements, skills, tools, education, certifications, and languages into a structured profile | P0 |
| RP-3 | Run OCR on image-only PDFs | P1 |
| RP-4 | Derive 5 to 8 selling points, each with a strength tier and the resume line that proves it | P0 |
| RP-5 | Compute the Resume Strength Score and list the three fixes that would raise it most | P0 |
| RP-6 | Infer current seniority level and suggest it as the default target | P0 |
| RP-7 | Let the user correct any extracted fact inline | P0 |
| RP-8 | Keep every resume version; the latest is active | P1 |

### Preferences

| ID | Requirement | Priority |
| --- | --- | --- |
| PF-1 | Capture location and work mode (on-site, hybrid, remote) as soft preferences | P0 |
| PF-2 | Capture work authorization: countries where the user can work without sponsorship, and whether they would accept sponsorship elsewhere | P0 |
| PF-3 | Capture a target seniority band of one or more adjacent levels | P0 |
| PF-4 | Capture an optional salary floor and currency as a soft preference | P0 |
| PF-5 | Each preference fits on one screen and takes one tap, with inferred defaults pre-selected | P0 |

### AI interview

| ID | Requirement | Priority |
| --- | --- | --- |
| IN-1 | Ask 5 to 7 questions, chosen from gaps and ambiguities in the parsed resume | P0 |
| IN-2 | Cover unlisted skills, unquantified achievements, scope of responsibility, target roles, and roles to avoid | P0 |
| IN-3 | Let the user skip any question or end the interview early | P0 |
| IN-4 | Write confirmed answers into the profile as evidence, tagged as user-stated | P0 |
| IN-5 | Let the user reopen the interview later to add more | P1 |

### Discovery

| ID | Requirement | Priority |
| --- | --- | --- |
| DS-1 | Generate search queries from the profile: target titles, title synonyms, adjacent roles, and key skills | P0 |
| DS-2 | Query all enabled sources in parallel and tolerate individual source failures | P0 |
| DS-3 | Normalize every job to one schema | P0 |
| DS-4 | Merge duplicates across sources and keep all source links | P0 |
| DS-5 | Drop expired postings and re-check stored jobs daily | P0 |
| DS-6 | Extract requirements, seniority, authorization signals, salary, and work mode from each description | P0 |
| DS-7 | Show a run summary: jobs fetched, duplicates merged, sources that failed | P1 |

### Matching and results

| ID | Requirement | Priority |
| --- | --- | --- |
| MR-1 | Apply hard gates before scoring | P0 |
| MR-2 | Compute Fit, Confidence, and Job Quality for every job that passes the relevance prefilter | P0 |
| MR-3 | Assign one verdict per job: Apply, Stretch, or Not a fit | P0 |
| MR-4 | Write a one-sentence reason for every verdict | P0 |
| MR-5 | Produce three points to capitalize on for every Apply and Stretch job | P0 |
| MR-6 | Stream results to the interface as they are scored | P0 |
| MR-7 | Let the user mark a job applied or dismiss it | P0 |
| MR-8 | Show the full score breakdown and requirement table on expand | P0 |

### Not a fit

| ID | Requirement | Priority |
| --- | --- | --- |
| NF-1 | List every fetched job that is not Apply or Stretch, with a primary reason | P0 |
| NF-2 | Group jobs by primary reason and show counts | P0 |
| NF-3 | Provide a full report per job, as specified in the verdicts section | P0 |
| NF-4 | Show the gap insight: the most frequent missing requirements across rejected jobs | P0 |
| NF-5 | Fix a fact: correcting a profile fact re-scores all affected jobs | P0 |
| NF-6 | Run a full analysis on demand for jobs rejected at the prefilter | P1 |

### Tailored resume

| ID | Requirement | Priority |
| --- | --- | --- |
| TR-1 | Generate one tailored resume per job on request | P0 |
| TR-2 | Ask for confirmation of every missing keyword before adding it | P0 |
| TR-3 | Show ATS keyword coverage before and after | P0 |
| TR-4 | Show a diff against the source resume | P1 |
| TR-5 | Export PDF and DOCX in an ATS-safe single-column layout | P0 |

### Monitoring

| ID | Requirement | Priority |
| --- | --- | --- |
| MN-1 | Re-run searches every 12 hours per active user (assumption) | P0 |
| MN-2 | Score only jobs not seen before | P0 |
| MN-3 | Show an in-app inbox of new Apply and Stretch matches since the last visit | P0 |
| MN-4 | Pause monitoring after 14 days without a login (assumption) | P1 |

### Profiles and local operation *(revised; replaces Account and billing)*

| ID | Requirement | Priority |
| --- | --- | --- |
| AB-1 | Create, rename, and switch between person profiles; no sign-up, login, or passwords | P0 |
| AB-2 | Keep every profile's data separate: resumes, matches, inbox, tailored resumes, confirmed keywords | P0 |
| AB-3 | Show model and aggregator spend per profile and per month, with an optional monthly budget the owner sets that pauses monitoring when reached | P0 |
| AB-4 | Export or delete all data for one profile | P0 |
| AB-5 | Listen only on the local machine (localhost) by default; never expose the app to the internet | P0 |

## Scoring systems

Seven scores drive the product. The user sees only the verdict by default; every score below appears in the expandable breakdown.

| Score | Scale | Applies to | Purpose |
| --- | --- | --- | --- |
| Resume Strength | 0 to 100 | The resume | Shows how well the resume sells the user |
| Selling-point tier | Signature, Strong, Supporting | Each selling point | Tells the user what to lead with |
| Hard gates | Pass, Fail, Unknown | Each job | Removes jobs the user cannot get |
| Fit | 0 to 100 | Each job | Measures match between profile and job |
| Confidence | High, Medium, Low | Each Fit score | Shows how much the posting let us judge |
| Job Quality | 0 to 100 | Each job | Filters stale, thin, or suspicious postings |
| ATS Keyword Coverage | 0 to 100% | Each resume and job pair | Measures the tailored resume's improvement |

### Resume Strength

| Component | Weight | What earns points |
| --- | --- | --- |
| Impact evidence | 30 | Achievements with numbers, outcomes, and scale |
| Skills depth | 20 | Skills shown in use, not only listed |
| Clarity and structure | 20 | Clear roles, dates, and readable bullets |
| Career trajectory | 15 | Growth in scope, consistent direction, explained gaps |
| ATS readability | 15 | Standard headings, parseable layout, no text in images |

### Selling-point tier

Each selling point is tested on three questions: is it quantified, is it from the last three years, and is it uncommon for the role. Three yeses make it Signature, two make it Strong, and one makes it Supporting.

### Hard gates

A failed gate sends the job to Not a fit without Fit scoring.

| Gate | Pass | Fail | Unknown |
| --- | --- | --- | --- |
| Work authorization | The job's country is on the user's list, or the job offers sponsorship and the user accepts it | The job requires authorization the user lacks and offers no sponsorship | The posting is silent; the job passes with a flag |
| Seniority | The job's level is inside the user's target band | The job's level is outside the band | The level cannot be inferred; the job passes with a flag |

Seniority uses one ladder: Intern, Entry, Mid, Senior, Lead or Staff, Manager, Director, VP, Executive.

### Fit

| Component | Weight | How it is scored |
| --- | --- | --- |
| Must-have coverage | 35 | Each must-have requirement is Met (1.0), Partial (0.5), or Missing (0); the component is the average |
| Experience relevance | 25 | Similarity of past roles to this role in function, domain, and company type |
| Skills and tools | 15 | Overlap between the job's named skills and the profile's evidenced skills |
| Scope alignment | 10 | Team size, budget, and ownership level compared with the job's |
| Preferences fit | 10 | Location, work mode, and salary against the user's soft preferences |
| Nice-to-haves | 5 | Coverage of preferred but optional requirements |

Every Met or Partial judgment must cite the resume line or interview answer that supports it. A judgment without evidence counts as Missing.

### Confidence

| Level | Rule |
| --- | --- |
| High | The posting states five or more explicit requirements and both gates resolve |
| Medium | The posting states three or four requirements, or one gate is Unknown |
| Low | The posting states fewer than three requirements, or both gates are Unknown |

### Job Quality

| Component | Weight | How it is scored |
| --- | --- | --- |
| Freshness | 40 | Full points up to 7 days old, declining to zero at 45 days |
| Description completeness | 25 | Presence of responsibilities, requirements, location, and employer name |
| Source reliability | 20 | Employer ATS feed scores highest, then official APIs, aggregators, and scraped boards |
| Legitimacy | 15 | Identifiable employer, no requests for payment from the applicant, no known scam patterns |

### ATS Keyword Coverage

Coverage is the weighted share of the job's keywords found in the resume. Must-have keywords weigh 2 and others weigh 1. An exact phrase counts in full and a synonym counts for half.

### Ranking and cost control

Jobs inside a tab are ordered by Priority, which is 0.8 × Fit + 0.2 × Job Quality.

A relevance prefilter ranks all fetched jobs by embedding similarity to the profile. The top 150 per run receive full scoring (assumption). The rest go to Not a fit with the reason Low relevance.

### Consistency rules

1. Scoring runs at temperature 0 with a fixed rubric and structured output.
2. Judgments are cached per profile version and job, so a job's score never changes unless the profile or posting changes.
3. Re-scoring the same pair must land within 3 points.

## Verdicts and the Not a fit report

Every fetched job receives exactly one of three verdicts, and Apply is deliberately hard to earn.

| Verdict | Rule | Tab label |
| --- | --- | --- |
| Apply | No gate fails, Fit is 80 or above, no must-have is Missing, Confidence is not Low, and Job Quality is 40 or above | Apply |
| Stretch | No gate fails and Fit is 65 to 79; or Fit is 80 or above but one must-have is Missing or Confidence is Low | Within reach |
| Not a fit | A gate fails, Fit is below 65, must-have coverage is below 50%, Job Quality is below 40, or the job was cut at the prefilter | Not a fit |

### The shape of encouragement

Strictness stays in the scoring; encouragement lives in how results are framed.

1. Stretch is shown as Within reach, never as a lesser result.
2. Every Stretch card shows the distance to Apply and the single biggest lever, for example "6 points from Apply: confirm your SQL experience."
3. An empty Apply tab never appears blank. It shows the three closest jobs and what would move each one.
4. Every Not a fit report ends with what would change the verdict, or states plainly that nothing in the user's control would.
5. The selling-points card stays one tap away on every screen, so the user's strengths are always visible next to their gaps.
6. Copy describes the match, never the person. The product says "this role asks for 8 years in finance" and never "you are underqualified."

### Primary reasons

Each Not a fit job carries one primary reason, used for grouping.

| Reason | Trigger |
| --- | --- |
| Work authorization | The authorization gate failed |
| Seniority mismatch | The seniority gate failed |
| Missing must-haves | Must-have coverage is below 50% |
| Low overall fit | Fit is below 65 with no single dominant cause |
| Low relevance | The job was cut at the prefilter |
| Poor posting | Job Quality is below 40 |
| Unsupported language | The posting is not in English |

Exact duplicates and expired postings are not listed. They are counted in the run summary.

### Report contents

Each report contains seven parts, in this order.

1. Primary reason in one sentence.
2. Gate results for authorization and seniority, with the posting text that decided each.
3. Requirement table: every requirement, its type (must-have or nice-to-have), its judgment, and the evidence or the absence of it.
4. Score breakdown: Fit by component, Confidence, and Job Quality.
5. Points lost: the three largest deductions, ranked.
6. What would change this verdict: gaps the user could close, separated from those they cannot.
7. Fix a fact: a control to correct any profile fact the report relied on.

Jobs cut at the prefilter get a short report with parts 1 and 7 and a Run full analysis button.

### Gap insight

The top of the Not a fit tab aggregates the requirement tables of all rejected jobs. It shows the five requirements most often Missing and the number of jobs each one blocks.

## Tailored resume

Tailoring optimizes hard for ATS keyword match, and the only way a new claim enters the resume is the user's confirmation.

### How keywords are handled

| Keyword status | Action |
| --- | --- |
| Present in the resume | Moved higher and repeated where natural |
| Present under a synonym | Rewritten to the job's exact phrasing, automatically |
| Absent, user taps Have it | Added, using the user's one-line description of where they used it |
| Absent, user taps Don't have it | Left out and recorded as a gap |

### What tailoring changes

1. Rewrites the summary around the job's top requirements.
2. Reorders bullets so the most relevant evidence comes first in each role.
3. Rephrases bullets to mirror the job's vocabulary.
4. Reorders and trims the skills section to the job's keywords.
5. Drops content irrelevant to the job when length requires it.

### What tailoring never changes

Employers, job titles, dates, degrees, and certifications stay exactly as in the source resume. Numbers in achievements are never altered.

### Output

1. An ATS-safe layout: single column, standard headings, no tables, no images, no text boxes.
2. PDF and DOCX downloads.
3. Keyword coverage before and after, with a target of 85% or higher after tailoring.
4. A diff against the source resume.
5. A list of confirmed keywords added, so the user can prepare to speak to each in an interview.

## Job sources and ingestion

Sources are organized in four tiers by reliability and risk, and every source sits behind its own adapter with a kill switch.

| Tier | Sources | Method | Risk |
| --- | --- | --- | --- |
| 1 | Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee | Public ATS job-board endpoints, per company | Low |
| 2 | Adzuna, Remotive, RemoteOK, Arbeitnow, Jobicy, Himalayas, The Muse, USAJobs, Hacker News Who's Hiring, We Work Remotely | Free APIs and RSS | Low |
| 3 | JSearch, SerpApi Google Jobs, TheirStack, Apify actors | Paid aggregator APIs | Low legal risk, per-call cost |
| 4 | LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google Jobs, Bayt, employer career pages | Direct scraping, with JobSpy as the starting library | High: terms-of-service breach, account bans, and IP blocking; off by default |

Endpoint details, quotas, and pricing for each source need verification during build; they change often.

### Pipeline

1. Plan: the agent turns the profile into queries per source, covering target titles, synonyms, adjacent roles, and locations.
2. Fetch: adapters run in parallel with per-source rate limits and timeouts.
3. Normalize: every result is mapped to the common job schema.
4. Deduplicate: jobs are merged on employer, title, and location, then on description similarity.
5. Validate: expired and unreachable postings are dropped.
6. Enrich: a small model extracts requirements, seniority, authorization signals, salary, and work mode.
7. Prefilter: jobs are ranked by embedding similarity to the profile.
8. Score: gates, Fit, Confidence, and Job Quality are computed and a verdict is assigned.

### Tier 1 company registry

ATS endpoints are queried per company, so the product needs a registry of employer identifiers for each ATS. The registry starts from public lists and grows whenever a Tier 2 to 4 result links to an ATS-hosted posting.

### Scraping safeguards

1. Each Tier 4 adapter has a rate limit and an on/off switch, and is off by default. No proxy pool: this is personal, low-volume use.
2. When a Tier 4 source fails, the same queries fall back to Tier 3 aggregators.
3. Scraped pages are stored only as normalized job fields plus the source link.
4. The owner turns on a Tier 4 board only after reading that board's terms and accepting the risk. Never use a logged-in personal account (for example a LinkedIn login) for scraping, since that account can be banned.

## Agent architecture

The agent handles the four tasks that need judgment, and plain pipeline code handles everything that can be deterministic.

&#91;embedded content: system architecture · 4 layers\]

The API hands work to the agent; the agent dispatches pipeline workers, which pull from job sources and write to the database the scorer reads.

### Claude Code's two roles

| Role | What it does |
| --- | --- |
| Builder | Implements the product phase by phase from this PRD, with you reviewing each phase |
| Runtime agent | Plans searches, scores jobs, tailors resumes, and drafts fixes when a scraper breaks |

The app runs only on the owner's machine, using the owner's own Claude account or API key; nothing is hosted for other people. Which runtime to use (Claude Code headless with the owner's subscription, or the Claude API with the owner's API key) is decided in Phase 0 against the current [Claude Code documentation](https://docs.claude.com/en/docs/claude-code/overview) and terms. Because friends' data passes through it, the API key route is the safer default if the subscription terms are unclear.

### Runtime agent tasks

| Task | Input | Output | Human approval |
| --- | --- | --- | --- |
| Search planner | Profile and preferences | Queries per source | None |
| Scorer | Profile and enriched job | Gate results, scores, verdict, reason, report | None |
| Resume tailor | Profile, job, confirmed keywords | Tailored resume and coverage scores | The user confirms keywords |
| Adapter repair | Failing adapter and sample page | A proposed code change | The owner approves before it is used |

### Model tiering

A small, cheap model handles extraction and enrichment. A large model handles scoring reports, the interview, and tailoring. Embeddings handle the prefilter.

### Stack (assumption)

| Layer | Choice |
| --- | --- |
| Web app | Next.js with server-sent events for streaming, served on localhost |
| API and workers | TypeScript or Python services with a job queue |
| Database | A local database: SQLite, or Postgres with pgvector if embeddings need it |
| File storage | A folder on the owner's machine for resumes and generated files |
| Scraping | JobSpy plus custom adapters, off by default |

## Data model

Twelve entities cover v1, plus a run log.

| Entity | Key fields |
| --- | --- |
| Person | Display name, created time *(revised: no email, trial, or subscription)* |
| Resume | File, parsed text, version, active flag |
| Profile | Roles, skills, education, inferred seniority, Resume Strength, profile version |
| SellingPoint | Statement, tier, evidence reference |
| Evidence | Source (resume line, interview answer, or confirmed keyword), text |
| Preferences | Locations, work modes, authorization countries, sponsorship acceptance, seniority band, salary floor |
| Job | Employer, title, location, work mode, seniority, salary, description, posted date, status, Job Quality |
| JobSource | Job, source name, tier, link, fetched time |
| Requirement | Job, text, type (must-have or nice-to-have), keywords |
| Match | Profile version, job, gate results, Fit by component, Confidence, verdict, primary reason, one-sentence reason, user state (new, applied, dismissed) |
| RequirementJudgment | Match, requirement, judgment, evidence reference |
| TailoredResume | Match, content, coverage before and after, confirmed keywords, files |

A SearchRun record logs each run's sources, counts, failures, and cost. A Spend record logs each paid call's cost against a profile.

## Running cost *(revised; replaces Pricing and trial)*

Nothing is sold. The owner pays for the model and any paid aggregators, so the app keeps that cost visible and bounded.

| Item | Rule |
| --- | --- |
| Who pays | The owner, through their own Claude account or API key and any aggregator keys |
| Cost visibility | Spend per profile and per month on screen (AB-3) |
| Monthly budget | Optional; set by the owner; when reached, monitoring pauses and on-demand actions ask first |
| Daily caps | 3 on-demand searches and 10 tailored resumes per profile per day (assumption), to stop runaway spend |
| Data retention | Kept until the owner deletes the profile |

## Metrics

The north star is median time to first strong match, with a proposed target under 10 minutes from creating a profile. With a handful of profiles these are checks, not statistics.

| Metric | Definition | Proposed target |
| --- | --- | --- |
| Time to first strong match | Minutes from profile creation to the first Apply verdict shown | Median under 10 |
| First-session match rate | Share of users who see at least one Apply job in their first session | 70% |
| Onboarding completion | Share of profiles that finish preferences | 80% |
| Interview completion | Share of users who answer at least three interview questions | 60% |
| Tailoring rate | Share of Apply jobs that get a tailored resume | 40% |
| Applied rate | Share of Apply jobs marked applied | 30% |
| Fix-a-fact rate | Share of Not a fit reports where the user corrects a fact | Under 5% |
| Score stability | Share of re-scores landing within 3 points | 95% |
| Cost per profile | Model and aggregator spend per profile per month | Under the owner's monthly budget |

All targets are proposals to check against the first month of real use.

## Non-functional requirements, privacy, and terms

The speed targets below exist to protect the north-star metric.

| Area | Requirement |
| --- | --- |
| Resume parsing | Selling-points card on screen within 20 seconds of upload |
| First result | First scored job on screen within 60 seconds of profile completion |
| Full run | Complete within 5 minutes |
| Tailored resume | Generated within 45 seconds of keyword confirmation |
| Availability | A failed source never fails a run |
| Devices | Runs in a browser on the owner's machine (macOS, Windows, or Linux); responsive layout |
| Accessibility | WCAG 2.1 AA |

### Privacy

1. All data stays on the owner's machine, apart from the calls the app makes to the model provider and job sources. The data folder relies on the machine's own disk encryption (FileVault, BitLocker, or LUKS).
2. The owner can export or delete any profile's data at any time, and deletes a friend's data when that friend asks.
3. Resume data is never sold or shared with employers or job boards.
4. The model provider account must be configured so data is not used for training.
5. The owner asks each friend before adding their resume, and tells them it is sent to the model provider for analysis. No privacy policy is needed because nothing is offered to the public.

### Fairness

Scoring uses only job-relevant evidence. Name, photo, age, gender, nationality, and marital status are stripped before any scoring call. Work authorization is used only as the user stated it.

### Terms of service

Not monetizing does not change a job board's terms: direct scraping of LinkedIn, Indeed, Glassdoor and similar boards breaches most of their terms whether or not money is involved. For small-scale personal use the practical risk is account bans and IP blocks rather than legal action, but it is not zero. Tier 4 is therefore off by default, enabled per board by the owner's choice, and never with a logged-in personal account. The app must work well on tiers 1 to 3 alone, where Tier 3 aggregators carry the scraping risk for you.

## Out of scope for v1

These were considered and deliberately left out.

- Cover letters and application-form answers
- Auto-apply
- A full application tracker; v1 has only applied and dismissed states
- Email, WhatsApp, and push alerts
- Languages other than English
- Learning from user behaviour
- Native mobile apps and a browser extension
- Coach, agency, and team accounts
- Hosting the app for other people, public sign-up, accounts and logins
- Trial, pricing, billing, and any monetization
- Interview preparation and salary negotiation
- User-adjustable score weights

## Risks and open questions

The two largest risks are scraping exposure and the owner's running cost.

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Job boards block or object to scraping | Tier 4 coverage disappears; a personal account could be banned | Off by default, aggregator fallback, no logged-in accounts, an app that works on tiers 1 to 3 |
| Model and aggregator cost grows beyond what the owner wants to pay | Unwelcome bills | Spend shown per profile, monthly budget, prefilter cap, model tiering, caching, daily caps |
| Users distrust scores | Low engagement with verdicts | Evidence cited for every judgment, Fix a fact, score stability rule |
| Users confirm keywords they do not have | Resumes that overclaim | One-line usage description required per keyword; list of added keywords shown for interview preparation |
| Postings rarely state sponsorship | Many Unknown authorization gates | Unknown passes with a flag; employer-level sponsorship history is a later enhancement |
| Strict verdicts leave new users with an empty Apply tab | Slow time to first strong match | Closest-three view, adjacent-title widening, Stretch framed as Within reach |
| In-app-only alerts are missed | Monitoring delivers little value | Revisit email alerts after a month of use |
| Monitoring only runs while the owner's machine is on | Gaps in monitoring | Catch-up run at startup |

### Open questions

- [ ] Runtime on the owner's machine: Claude Code headless with the owner's subscription, or the Claude API with an API key (decided in Phase 0)?
- [ ] Which Tier 4 boards, if any, will the owner turn on?
- [ ] Where does the initial Tier 1 company registry come from?
- [ ] Is 12 hours the right monitoring interval?
- [ ] Are the daily caps and the 150-job scoring cap right for the owner's budget?
- [ ] What is the app's name? (cosmetic)

## Release plan

Six phases, each built with Claude Code and closed by an exit test before the next begins.

1. **Foundations.** Person profiles, resume intake, parsing, profile, selling points, and Resume Strength. Exit: 20 varied test resumes parse with correct roles, dates, and skills.
2. **Matching core.** Tier 1 and 2 adapters, the pipeline, gates, Fit, Confidence, Job Quality, and verdicts. Exit: score stability holds at 95% on a fixed test set.
3. **Results experience.** Preferences, AI interview, three tabs, job detail, Not a fit reports, gap insight, and Fix a fact. Exit: five test users reach a first Apply verdict in under 10 minutes.
4. **Tailoring.** Keyword confirmation, generation, coverage scores, diff, and exports. Exit: tailored resumes parse cleanly in three common ATS parsers.
5. **Full coverage and monitoring.** Tier 3 and 4 adapters, kill switches, scheduled runs, and the in-app inbox. Exit: a run completes with any single source disabled.
6. **Local packaging and data controls.** *(revised)* Profile management, per-profile export and deletion, spend panel and monthly budget, and a one-command local install and start. Exit: on a fresh machine, the owner installs, starts the app, creates a profile and reaches a first match, then exports and deletes that profile cleanly.

## Change log

- **Nov 11, 2026, scope revision.** The app is a personal tool that runs locally on the owner's machine, for the owner and a few friends, and is never hosted or monetized. Removed: the consumer framing, sign-up, the 7-day trial, the paywall, billing, pricing, launch markets, legal review, privacy policy, and proxy pool. Replaced Account and billing (AB-1 to AB-4) with Profiles and local operation (AB-1 to AB-5), Flow 8 Trial end with Managing profiles, Pricing and trial with Running cost, and Phase 6 with Local packaging and data controls. Tier 4 scraping is now off by default.
