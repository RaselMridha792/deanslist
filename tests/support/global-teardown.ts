import { removeTestAccounts } from "./accounts";

/** After the run: delete the accounts global setup created, and only those. */
export default async function globalTeardown(): Promise<void> {
  await removeTestAccounts();
}
