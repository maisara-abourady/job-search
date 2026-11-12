import { ResultsController } from "@matchmaker/delivery";
import { InProcessWorkQueue } from "@matchmaker/adapters";
import type {
  AtsLinkRecognizer,
  Clock,
  CompanyRegistry,
  IdGenerator,
  JobSource,
  MatchJudge,
  MatchNarrator,
  MatchRecords,
  MonitoringRoster,
  MonthlyBudgetControl,
  People,
  PersonDataVault,
  PostingCatalog,
  PostingEnricher,
  PostingLiveness,
  PostingsForScoring,
  ProductEvents,
  ProfileVersions,
  ProfilesForScoring,
  ProfilesForSearch,
  RelevanceRanker,
  ResultsFeed,
  ResultsReadModel,
  SearchPlanner,
  SearchRunHistory,
  SearchRuns,
  SourceSwitchControl,
  SourceSwitchboard,
  SpendAttribution,
  SpendLedger,
  UsageLedger,
} from "@matchmaker/use-cases";
import {
  CreatePersonInteractor,
  DeletePersonInteractor,
  ExportPersonDataInteractor,
  ListPeopleInteractor,
  ListResultsInteractor,
  MeasuredCreatePerson,
  MeasuredListResults,
  MeasuredRecordJobDecision,
  OpenPersonInteractor,
  OperateSourcesInteractor,
  RecheckStoredPostingsInteractor,
  RecordJobDecisionInteractor,
  RenamePersonInteractor,
  RescoreAllInteractor,
  RunDueMonitoringInteractor,
  RunFullAnalysisInteractor,
  RunJobSearchInteractor,
  ScoreJobsInteractor,
  SetMonthlyBudgetInteractor,
  SpendingGuard,
  ViewJobDetailInteractor,
  ViewRunningCostInteractor,
} from "@matchmaker/use-cases/wiring";

/** Storage gateways, by need. One implementation may satisfy all of them (in-memory today; a local database later, D2). */
export type MatchmakerStorage = ProfilesForScoring &
  ProfilesForSearch &
  ProfileVersions &
  PostingsForScoring &
  PostingCatalog &
  MatchRecords &
  ResultsReadModel &
  SearchRuns &
  People &
  MonitoringRoster &
  MonthlyBudgetControl &
  CompanyRegistry &
  SourceSwitchboard;

/** Every detail Main must choose. A configuration (dev, test, the owner's local install) is one value of this type. */
export type MatchmakerDetails = {
  readonly storage: MatchmakerStorage;
  readonly operatorConsole: SourceSwitchControl & SearchRunHistory;
  /** Daily-cap counts per profile (ADR 0015). */
  readonly usage: UsageLedger;
  /** ADR 0010: the ledger spend is stored in, and the attribution the cost-incurring use cases charge through. The
   * same configuration hands the matching SpendMeter to every adapter that spends money. */
  readonly spendLedger: SpendLedger;
  readonly spendAttribution: SpendAttribution;
  /** AB-4: every store holding a person's data, composed by the configuration (ADR 0014). */
  readonly personData: PersonDataVault;
  /** ADR 0011: where product events go (in memory today; the local database later, ADR 0016). */
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
  const spending = new SpendingGuard({ people: d.storage, usage: d.usage, budget: d.storage, spend: d.spendLedger, clock: d.clock });

  const scoreJobs = new ScoreJobsInteractor({
    profiles: d.storage,
    postings: d.storage,
    matches: d.storage,
    judge: d.judge,
    narrator: d.narrator,
    feed: d.feed,
    spend: d.spendAttribution,
    clock: d.clock,
  });
  const rescoreAll = new RescoreAllInteractor(d.storage, scoreJobs);
  const runJobSearch = new RunJobSearchInteractor({
    sources: d.sources,
    switchboard: d.storage,
    planner: d.planner,
    enricher: d.enricher,
    ranker: d.ranker,
    profiles: d.storage,
    catalog: d.storage,
    liveness: d.liveness,
    runs: d.storage,
    atsLinks: d.atsLinks,
    registry: d.registry ?? d.storage,
    spending,
    spend: d.spendAttribution,
    spendLedger: d.spendLedger,
    clock: d.clock,
    ids: d.ids,
    scoring: { score: async (r) => void (await scoreJobs.execute(r)) },
  });

  // Request ports owned by onboarding and monitoring, wired to discovery and matching through background work.
  const searchRequests = {
    requestSearch: async (personId: string, trigger: "onboarding" | "manual" | "scheduled") =>
      work.run(`search:${personId}`, () => runJobSearch.execute({ personId, trigger })),
  };
  const rescoreRequests = {
    rescoreAll: async (personId: string) => work.run(`rescore:${personId}`, () => rescoreAll.execute({ personId })),
  };

  // Measured input ports (ADR 0011): the use cases know nothing of measurement; every delivery gets the wrapped port.
  const listResults = new MeasuredListResults(new ListResultsInteractor(d.storage), d.productEvents, d.clock);
  const recordJobDecision = new MeasuredRecordJobDecision(new RecordJobDecisionInteractor(d.storage), d.productEvents, d.clock);

  return {
    useCases: {
      // Profiles (AB-1, AB-2, AB-4)
      createPerson: new MeasuredCreatePerson(
        new CreatePersonInteractor({ people: d.storage, ids: d.ids, clock: d.clock }),
        d.productEvents,
      ),
      renamePerson: new RenamePersonInteractor(d.storage),
      listPeople: new ListPeopleInteractor(d.storage),
      openPerson: new OpenPersonInteractor(d.storage, d.clock),
      exportPersonData: new ExportPersonDataInteractor({ people: d.storage, vault: d.personData }),
      deletePerson: new DeletePersonInteractor({ people: d.storage, vault: d.personData }),
      // Spending (AB-3)
      viewRunningCost: new ViewRunningCostInteractor({ people: d.storage, spend: d.spendLedger, budget: d.storage, clock: d.clock }),
      setMonthlyBudget: new SetMonthlyBudgetInteractor(d.storage),
      // Discovery, matching, results
      runJobSearch,
      recheckStoredPostings: new RecheckStoredPostingsInteractor(d.storage, d.liveness),
      scoreJobs,
      rescoreAll,
      runFullAnalysis: new RunFullAnalysisInteractor(scoreJobs),
      listResults,
      viewJobDetail: new ViewJobDetailInteractor(d.storage),
      recordJobDecision,
      // Monitoring: each configuration calls this at start (the catch-up run) and then on its timer (ADR 0016).
      runDueMonitoring: new RunDueMonitoringInteractor({ roster: d.storage, searches: searchRequests, spending, clock: d.clock }),
      operateSources: new OperateSourcesInteractor(d.operatorConsole, d.operatorConsole),
      // HAND-OFF: IntakeResume, CorrectProfile, ConductInterview, TailorResume, ReviewNotAFit, ViewInbox as their phases
      // arrive. Wrap CorrectProfile, ConductInterview and TailorResume in their measured decorators when they are wired
      // (ADR 0011 hand-off), and pass them spendAttribution; TailorResume and IntakeResume also get `spending`.
    },
    requests: { searchRequests, rescoreRequests },
    controllers: { results: new ResultsController(listResults, recordJobDecision) },
    work,
  };
}
export type Matchmaker = ReturnType<typeof composeMatchmaker>;
