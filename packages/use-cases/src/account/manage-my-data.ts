import { DATA_RETENTION_DAYS_AFTER_EXPIRY } from "@matchmaker/rules";
import type { Clock } from "../shared/ports.ts";
import type { Accounts, UserDataVault } from "./ports.ts";

/** AB-4, Privacy 2, Pricing "data after expiry". */
export interface ExportMyData {
  execute(request: { userId: string }): Promise<{ archive: Uint8Array }>;
}
export interface DeleteMyData {
  execute(request: { userId: string }): Promise<void>;
}
export interface PurgeExpiredAccounts {
  execute(): Promise<{ purged: number }>;
}
export class ExportMyDataInteractor implements ExportMyData {
  private readonly vault: UserDataVault;
  constructor(vault: UserDataVault) {
    this.vault = vault;
  }
  async execute(r: { userId: string }): Promise<{ archive: Uint8Array }> {
    return { archive: await this.vault.exportAll(r.userId) };
  }
}
export class DeleteMyDataInteractor implements DeleteMyData {
  private readonly vault: UserDataVault;
  constructor(vault: UserDataVault) {
    this.vault = vault;
  }
  async execute(r: { userId: string }): Promise<void> {
    await this.vault.eraseAll(r.userId);
  }
}
export class PurgeExpiredAccountsInteractor implements PurgeExpiredAccounts {
  private readonly d: { accounts: Accounts; vault: UserDataVault; clock: Clock };
  constructor(dependencies: PurgeExpiredAccountsInteractor["d"]) {
    this.d = dependencies;
  }
  async execute(): Promise<{ purged: number }> {
    const cutoff = new Date(this.d.clock.now().getTime() - DATA_RETENTION_DAYS_AFTER_EXPIRY * 86_400_000).toISOString();
    const expired = await this.d.accounts.paywalledBefore(cutoff);
    for (const userId of expired) await this.d.vault.eraseAll(userId);
    return { purged: expired.length };
  }
}
