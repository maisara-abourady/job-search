/**
 * "Nothing is invented" and "What tailoring never changes" (PRD: Tailored resume) as a rule that any
 * resume writer's output must pass. The writer is a model outside the rules; this guard is the policy.
 */
export type ResumeDocument = {
  readonly summary: string;
  readonly roles: readonly {
    readonly employer: string;
    readonly title: string;
    readonly start: string;
    readonly end: string | null;
    readonly bullets: readonly string[];
  }[];
  readonly skills: readonly string[];
  readonly credentials: readonly { readonly name: string; readonly issuer: string; readonly year: string | null }[];
};

export type TailoringViolation =
  | { readonly kind: "role-identity-changed"; readonly detail: string }
  | { readonly kind: "credential-changed"; readonly detail: string }
  | { readonly kind: "number-altered"; readonly detail: string }
  | { readonly kind: "unconfirmed-keyword-added"; readonly detail: string };

const numbersIn = (s: string) => s.match(/\d+(?:[.,]\d+)*/g) ?? [];

export function checkTailoredResume(input: {
  source: ResumeDocument;
  tailored: ResumeDocument;
  /** Keywords absent from the source that the user confirmed with "Have it". */
  confirmedKeywords: readonly string[];
  /** Keywords the job asks for that the source resume lacked, exact or by synonym. */
  absentKeywords: readonly string[];
}): TailoringViolation[] {
  const v: TailoringViolation[] = [];
  const { source, tailored } = input;
  const identity = (r: ResumeDocument["roles"][number]) => `${r.employer}|${r.title}|${r.start}|${r.end ?? ""}`;
  const sourceRoles = new Set(source.roles.map(identity));
  for (const r of tailored.roles) if (!sourceRoles.has(identity(r))) v.push({ kind: "role-identity-changed", detail: identity(r) });
  const cred = (c: ResumeDocument["credentials"][number]) => `${c.name}|${c.issuer}|${c.year ?? ""}`;
  const sourceCreds = new Set(source.credentials.map(cred));
  for (const c of tailored.credentials) if (!sourceCreds.has(cred(c))) v.push({ kind: "credential-changed", detail: cred(c) });
  const sourceNumbers = new Set(source.roles.flatMap((r) => r.bullets.flatMap(numbersIn)));
  for (const n of tailored.roles.flatMap((r) => r.bullets.flatMap(numbersIn))) {
    if (!sourceNumbers.has(n)) v.push({ kind: "number-altered", detail: n });
  }
  const tailoredText = JSON.stringify(tailored).toLowerCase();
  for (const k of input.absentKeywords) {
    if (!input.confirmedKeywords.includes(k) && tailoredText.includes(k.toLowerCase()))
      v.push({ kind: "unconfirmed-keyword-added", detail: k });
  }
  return v;
}
