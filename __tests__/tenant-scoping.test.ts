import { eq } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { leads, notes, rateLimit, scheduledEmails } from "@/db/schema";
import { ownedBy, scoped, systemScope } from "@/lib/tenant";

const qb = new QueryBuilder();
const scope = systemScope("11111111-1111-1111-1111-111111111111", "cron_daily");

describe("ownedBy", () => {
  it("emits a trainer_id predicate for leads", () => {
    const query = qb.select().from(leads).where(ownedBy(leads, scope));
    const { sql, params } = query.toSQL();
    expect(sql).toContain('"trainer_id" =');
    expect(params).toContain(scope.trainerId);
  });

  it("emits a trainer_id predicate for notes", () => {
    const query = qb.select().from(notes).where(ownedBy(notes, scope));
    const { sql, params } = query.toSQL();
    expect(sql).toContain('"trainer_id" =');
    expect(params).toContain(scope.trainerId);
  });

  it("emits a trainer_id predicate for scheduledEmails", () => {
    const query = qb.select().from(scheduledEmails).where(ownedBy(scheduledEmails, scope));
    const { sql, params } = query.toSQL();
    expect(sql).toContain('"trainer_id" =');
    expect(params).toContain(scope.trainerId);
  });

  it("rejects a table with no trainerId column at compile time", () => {
    // @ts-expect-error rateLimit has no trainerId column — this must not typecheck.
    ownedBy(rateLimit, scope);
  });
});

describe("scoped", () => {
  it("ANDs the trainer_id predicate with extra conditions", () => {
    const query = qb.select().from(leads).where(scoped(leads, scope, eq(leads.stage, "email_lead")));
    const { sql, params } = query.toSQL();
    expect(sql).toContain('"trainer_id" =');
    expect(sql).toContain('"stage" =');
    expect(params).toContain(scope.trainerId);
  });
});

describe("systemScope", () => {
  it("mints a scope carrying the given trainerId", () => {
    const s = systemScope("abc-123", "site_key_ingest");
    expect(s.trainerId).toBe("abc-123");
  });
});
