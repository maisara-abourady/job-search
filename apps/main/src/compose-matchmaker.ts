import { ResultsController } from "@matchmaker/delivery";
import { InProcessWorkQueue } from "@matchmaker/adapters";
import type {
  Accounts, AccountsForAccess, AtsLinkRecognizer, Clock, CompanyRegistry, IdGenerator, JobSource, MatchJudge, MatchNarrator,
  MatchRecords, PostingCatalog, PostingEnricher, PostingLiveness, PostingsForScoring, ProfileVersions, ProfilesForScoring,
  ProfilesForSearch, RelevanceRanker, ResultsFeed, ResultsReadModel, SearchPlanner, SearchRunHistory, SearchRuns,
  SourceSwitchControl, SourceSwitchboard, UsageLedger,
} from "@matchmaker/use-cases";
import {
  AccessGuard, ListResultsInteractor, RecheckStoredPostingsInteractor, RecordJobDecisionInteractor, RescoreAllInteractor,
  RunDueMonitoringInteractor, RunFullAnalysisInteractor, RunJobSearchInteractor, ScoreJobsInteractor, SignUpInteractor,
  ViewAccessInteractor, OperateSourcesInteractor,
} from "@matchmaker/use-cases/wiring";

/** Storage gateways, by need. One implementation may satisfy all of them (in-memory today). */
export type MatchmakerStorage = ProfilesForScoring & ProfilesForSearch & ProfileVersions & PostingsForScoring & PostingCatalog &
  MatchRecords & ResultsReadModel & SearchRuns & Accounts & AccountsForAccess & CompanyRegistry & SourceSwitchboard;

/** Every detail Main must choose. A configuration (dev, test, production, per market) is one value of this type. */
export type MatchmakerDetails = {
  readonly storage: MatchmakerStorage;
  readonly operatorConsole: SourceSwitchControl & SearchRunHistory;
  readonly usage: UsageLedger;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly judge: MatchJudge;
  readonly narrator: MatchNarrator;
  readonly planner: SearchPlanner;
  readonly enricher: PostingEnricher;
  readonly ranker: RelevanceRanker;
  readonly sources: readonly JobSource[];
  readonly liveness: PostingLiveness;
  readonly atsLinks: AtsLinkRecognizer;
  readonly registry?: CompanyRegistry;
  readonly feed: ResultsFeed;
  readonly onBackgroundError: (task: string, error: unknown) => void;
};

/**
 * Main's one job (§10.1): create the interactors, hand each its ports, connect the areas through the
 * request ports they own, and return the input ports and controllers. No policy lives here.
 */
export function composeMatchmaker(d: MatchmakerDetails) {
  const work = new InProcessWorkQueue(d.onBackgroundError);
  const access = new AccessGuard(d.storage, d.usage, d.clock);

  const scoreJobs = new ScoreJobsInteractor({
    profiles: d.storage, postings: d.storage, matches: d.storage, judge: d.judge, narrator: d.narrator, feed: d.feed, clock: d.clock,
  });
  const rescoreAll = new RescoreAllInteractor(d.storage, scoreJobs);
  const runJobSearch = new RunJobSearchInteractor({
    sources: d.sources, switchboard: d.storage, planner: d.planner, enricher: d.enricher, ranker: d.ranker,
    profiles: d.storage, catalog: d.storage, liveness: d.liveness, runs: d.storage, atsLinks: d.atsLinks,
    registry: d.registry ?? d.storage, access, clock: d.clock, ids: d.ids,
    scoring: { score: async (r) => void (await scoreJobs.execute(r)) },
  });

  // Request ports owned by onboarding and monitoring, wired to discovery and matching through background work.
  const searchRequests = {
    requestSearch: async (userId: string, trigger: "onboarding" | "manual" | "scheduled") =>
      work.run(`search:${userId}`, () => runJobSearch.execute({ userId, trigger })),
  };
  const rescoreRequests = { rescoreAll: async (userId: string) => work.run(`rescore:${userId}`, () => rescoreAll.execute({ userId })) };

  const listResults = new ListResultsInteractor(d.storage);
  const recordJobDecision = new RecordJobDecisionInteractor(d.storage);

  return {
    useCases: {
      signUp: new SignUpInteractor(d.storage, d.clock),
      viewAccess: new ViewAccessInteractor(d.storage, d.clock),
      runJobSearch,
      recheckStoredPostings: new RecheckStoredPostingsInteractor(d.storage, d.liveness),
      scoreJobs,
      rescoreAll,
      runFullAnalysis: new RunFullAnalysisInteractor(scoreJobs),
      listResults,
      recordJobDecision,
      runDueMonitoring: new RunDueMonitoringInteractor({ usersWithMonitoringOn: async () => [] }, searchRequests, d.clock),
      operateSources: new OperateSourcesInteractor(d.operatorConsole, d.operatorConsole),
      // HAND-OFF: IntakeResume, CorrectProfile, ConductInterview, TailorResume, ViewJobDetail, ReviewNotAFit, ViewInbox,
      // StartCheckout, RecordSubscriptionChange, ExportMyData, DeleteMyData, PurgeExpiredAccounts as their phases arrive.
    },
    requests: { searchRequests, rescoreRequests },
    controllers: { results: new ResultsController(listResults, recordJobDecision) },
    work,
  };
}
export type Matchmaker = ReturnType<typeof composeMatchmaker>;
