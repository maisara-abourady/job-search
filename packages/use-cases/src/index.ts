/**
 * @matchmaker/use-cases: the application's use cases, grouped by the actor and area they serve.
 * Published here: input ports, request/response models, and the ports (gateways, output ports) the
 * use cases own, as TYPES ONLY. Interactor classes are published separately in ./wiring for Main alone.
 */

// Shared
export type { Clock, IdGenerator } from "./shared/ports.ts";
export type { CappedAction, MonthlyBudgetSetting, PeopleForSpending, UsageLedger } from "./shared/spending-guard.ts";
export { UseCaseError } from "./shared/errors.ts";
export type {
  ChargeTo,
  Spend,
  SpendAttribution,
  SpendCategory,
  SpendLedger,
  SpendMeter,
  SpendPurpose,
  SpendRecord,
} from "./shared/metering.ts";

// Onboarding (job seeker): resume intake, profile correction and preferences, AI interview
export type { IntakeResume, IntakeResumeRequest, IntakeResumeResponse, SellingPointsCard } from "./onboarding/intake-resume.ts";
export type {
  CorrectProfile,
  CorrectProfileRequest,
  CorrectProfileResponse,
  PreferencesInput,
  ProfileCorrection,
} from "./onboarding/correct-profile.ts";
export type { ConductInterview, InterviewStepRequest, InterviewStepResponse } from "./onboarding/conduct-interview.ts";
export type {
  DocumentReader,
  InterviewQuestion,
  InterviewTranscripts,
  InterviewTurn,
  Interviewer,
  ProfileVersions,
  ReadDocumentResult,
  RescoreRequests,
  ResumeAnalyst,
  ResumeFiles,
  ResumeUpload,
  SearchRequests,
  StructuredResume,
} from "./onboarding/ports.ts";

// Discovery (job seeker, scheduler): searching every reachable source
export type { RunJobSearch, RunJobSearchRequest, RunJobSearchResponse } from "./discovery/run-job-search.ts";
export type { RecheckStoredPostings, RecheckStoredPostingsResponse } from "./discovery/recheck-stored-postings.ts";
export type {
  AtsCompany,
  AtsLinkRecognizer,
  CompanyRegistry,
  Enrichment,
  FoundPosting,
  JobSource,
  PostingCatalog,
  PostingEnricher,
  PostingLiveness,
  ProfilesForSearch,
  RelevanceRanker,
  ScoringRequests,
  SearchPlan,
  SearchPlanner,
  SearchQuery,
  SearchRunRecord,
  SearchRuns,
  SourceDescriptor,
  SourceSwitchboard,
} from "./discovery/ports.ts";

// Matching (matching-policy owner): verdicts for every fetched job
export type { ScoreJobs, ScoreJobsRequest, ScoreJobsResponse } from "./matching/score-jobs.ts";
export type { RunFullAnalysis, RunFullAnalysisRequest } from "./matching/run-full-analysis.ts";
export type { RescoreAll } from "./matching/rescore-all.ts";
export type {
  MatchJudge,
  MatchNarrator,
  MatchRecords,
  Narration,
  PostingsForScoring,
  ProfilesForScoring,
  ResultsFeed,
  ScoredJobNotice,
  StoredMatch,
} from "./matching/ports.ts";

// Results (job seeker): the three tabs, job detail, Not a fit review, applied/dismissed
export type { ListResults, ListResultsRequest, ListResultsResponse, ResultCard } from "./results/list-results.ts";
export type { ViewJobDetail, ViewJobDetailRequest, ViewJobDetailResponse } from "./results/view-job-detail.ts";
export type { ReviewNotAFit, ReviewNotAFitRequest, ReviewNotAFitResponse } from "./results/review-not-a-fit.ts";
export type { RecordJobDecision, RecordJobDecisionRequest } from "./results/record-job-decision.ts";
export type { EvidenceText, JobDetailRow, ResultRow, ResultsReadModel } from "./results/ports.ts";

// Tailoring (job seeker): a resume per job, nothing invented
export type { ConfirmedKeywords, MissingKeywordsResponse, TailorResume, TailoredResumeResponse } from "./tailoring/tailor-resume.ts";
export type {
  GeneratedFiles,
  KeywordMatcher,
  ResumeRenderer,
  ResumeWriter,
  TailoredResumeRecord,
  TailoredResumes,
  TailoringSources,
} from "./tailoring/ports.ts";

// Monitoring (scheduler, passive seeker)
export type { RunDueMonitoring, RunDueMonitoringResponse } from "./monitoring/run-due-monitoring.ts";
export type { InboxResponse, ViewInbox } from "./monitoring/view-inbox.ts";
export type { InboxSource, MonitoredPerson, MonitoringRoster, MonitoringSearchRequests } from "./monitoring/ports.ts";

// Profiles (the owner, managing the people they help): AB-1, AB-2, AB-4
export type {
  CreatePerson,
  CreatePersonRequest,
  CreatePersonResponse,
  ListPeople,
  OpenPerson,
  OpenPersonRequest,
  PersonSummary,
  RenamePerson,
  RenamePersonRequest,
} from "./profiles/manage-people.ts";
export type { DeletePerson, ExportPersonData } from "./profiles/person-data.ts";
export type { People, PersonDataVault } from "./profiles/ports.ts";

// Spending (the owner, paying the bills): AB-3, Running cost
export type {
  SetMonthlyBudget,
  SetMonthlyBudgetRequest,
  ViewRunningCost,
  ViewRunningCostRequest,
  ViewRunningCostResponse,
} from "./spending/running-cost.ts";
export type { MonthlyBudgetControl, PeopleForRunningCost } from "./spending/ports.ts";

// Measurement (the owner, checking the product works): product events, observed at other areas' input ports
export type { ProductEvent, ProductEventName, ProductEvents } from "./measurement/ports.ts";

// Operations (the owner as sourcing operator)
export type { OperateSources } from "./operations/operate-sources.ts";
export type { SearchRunHistory, SourceSwitchControl } from "./operations/ports.ts";
