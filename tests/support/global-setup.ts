import type { FullConfig } from "playwright/test";
import { isLocalTarget, provisionTestAccounts } from "./accounts";

/**
 * Before the run: create the suite's own dashboard accounts, local targets
 * only. A deployment has no database this process can write to, so there the
 * E2E_* variables have to be exported by hand. See tests/support/accounts.ts.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const base = String(config.projects[0]?.use?.baseURL ?? process.env.BASE_URL ?? "");
  if (!isLocalTarget(base)) return;
  await provisionTestAccounts();
}
