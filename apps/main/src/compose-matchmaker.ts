import { ResultsController } from "@matchmaker/delivery";
import { InProcessWorkQueue } from "@matchmaker/adapters";
import type {
  Accounts, AccountsForAccess, AtsLinkRecognizer, Clock, CompanyRegistry, IdGenerator, JobSource, MatchJudge, MatchNarrator,
  MatchRecords, PostingCatalog, PostingEnricher, PostingLiveness, PostingsForScoring, ProductEvents, ProfileVersions, ProfilesForScoring,
  ProfilesForSearch, RelevanceRanker, ResultsFeed, ResultsReadModel, SearchPlanner, SearchRunHistory, SearchRuns,
  SourceSwitchControl, SourceSwitchboard, SpendAttribution, SpendLedger, UsageLedger,
} from "@matchmaker/use-cases";
import {
  AccessGuard, ListResultsInteractor, MeasuredListResults, MeasuredRecordJobDecision, MeasuredRecordSubscriptionChange,
  MeasuredSignUp, RecheckStoredPostingsInteractor, RecordJobDecisionInteractor, RecordSubscriptionChangeInteractor,
  RescoreAllInteractor, RunDueMonitoringInteractor, RunFullAnalysisInteractor, RunJobSearchInteractor, ScoreJobsInteractor,
  SignUpInteractor, ViewAccessInteractor, ViewJobDetailInteractor, OperateSourcesInteractor,
} from "@matchmaker/use-cases/wiring";

/** Storage gateways, by need. One implementation may satisfy all of them (in-memory today). */
export type MatchmakerStorage = ProfilesForScoring & ProfilesForSearch & ProfileVersions & PostingsForScoring & PostingCatalog &
  MatchRecords & ResultsReadModel & SearchRuns & Accounts & AccountsForAccess & CompanyRegistry & SourceSwitchboard;

/** Every detail Main must choose. A configuration (dev, test, production, per market) is one value of this type. */
export type MatchmakerDetails = {
  readonly storage: MatchmakerStorage;
  readonly operatorConsole: SourceSwitchControl & SearchRunHistory;
  readonly usage: UsageLedger;
  /** ADR 0010: the ledger spend is stored in, and the attribution the cost-incurring use cases charge through. The
   * same configuration hands the matching SpendMeter to every adapter that spends money. */
  readonly spendLedger: SpendLedger;
  readonly spendAttribution: SpendAttribution;
  /** ADR 0011: where product events go (in memory today; D14). */
  readonly productEvents: ProductEvents;
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
    profiles: d.storage, postings: d.storage, matches: d.storage, judge: d.judge, narrator: d.narrator, feed: d.feed,
    spend: d.spendAttribution, clock: d.clock,
  });
  const rescoreAll = new RescoreAllInteractor(d.storage, scoreJobs);
  const runJobSearch = new RunJobSearchInteractor({
    sources: d.sources, switchboard: d.storage, planner: d.planner, enricher: d.enricher, ranker: d.ranker,
    profiles: d.storage, catalog: d.storage, liveness: d.liveness, runs: d.storage, atsLinks: d.atsLinks,
    registry: d.registry ?? d.storage, access, spend: d.spendAttribution, spendLedger: d.spendLedger, clock: d.clock, ids: d.ids,
    scoring: { score: async (r) => void (await scoreJobs.execute(r)) },
  });

  // Request ports owned by onboarding and monitoring, wired to discovery and matching through background work.
  const searchRequests = {
    requestSearch: async (userId: string, trigger: "onboarding" | "manual" | "scheduled") =>
      work.run(`search:${userId}`, () => runJobSearch.execute({ userId, trigger })),
  };
  const rescoreRequests = { rescoreAll: async (userId: string) => work.run(`rescore:${userId}`, () => rescoreAll.execute({ userId })) };

  // Measured input ports (ADR 0011): the use cases know nothing of measurement; every delivery gets the wrapped port.
  const listResults = new MeasuredListResults(new ListResultsInteractor(d.storage), d.productEvents, d.clock);
  const recordJobDecision = new MeasuredRecordJobDecision(new RecordJobDecisionInteractor(d.storage), d.productEvents, d.clock);

  return {
    useCases: {
      signUp: new MeasuredSignUp(new SignUpInteractor(d.storage, d.clock), d.productEvents),
      viewAccess: new ViewAccessInteractor(d.storage, d.clock),
      runJobSearch,
      recheckStoredPostings: new RecheckStoredPostingsInteractor(d.storage, d.liveness),
      scoreJobs,
      rescoreAll,
      runFullAnalysis: new RunFullAnalysisInteractor(scoreJobs),
      listResults,
      viewJobDetail: new ViewJobDetailInteractor(d.storage),
      recordJobDecision,
      runDueMonitoring: new RunDueMonitoringInteractor({ usersWithMonitoringOn: async () => [] }, searchRequests, d.clock),
      operateSources: new OperateSourcesInteractor(d.operatorConsole, d.operatorConsole),
      // Fed by the billing provider's webhook listener (D7) once it exists; idempotent per provider event id (ADR 0013).
      recordSubscriptionChange: new MeasuredRecordSubscriptionChange(new RecordSubscriptionChangeInteractor(d.storage), d.productEvents),
      // HAND-OFF: IntakeResume, CorrectProfile, ConductInterview, TailorResume, ReviewNotAFit, ViewInbox, StartCheckout,
      // ExportMyData, DeleteMyData, PurgeExpiredAccounts as their phases arrive. Wrap CorrectProfile, ConductInterview and
      // TailorResume in their measured decorators when they are wired (ADR 0011 hand-off), and pass them spendAttribution.
    },
    requests: { searchRequests, rescoreRequests },
    controllers: { results: new ResultsController(listResults, recordJobDecision) },
    work,
  };
}
export type Matchmaker = ReturnType<typeof composeMatchmaker>;
