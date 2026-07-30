import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApplicationQuestion, LeadAnswers } from "@/db/types";
import { sl } from "@/lib/strings";

function renderValue(value: LeadAnswers[string]): string {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

/**
 * `layout="single-card"` (default) — one Card wrapping every answer, used on
 * /leads/[id]. `layout="cards"` — one card per Q&A pair, used by the
 * Izpolnjene forme master-detail view. Both share the same known/archived
 * split — the archived-answers feature (answers whose question id no longer
 * exists in the trainer's current set) must render identically either way.
 */
export function AnswersView({
  answers,
  questions,
  layout = "single-card",
}: {
  answers: LeadAnswers | null;
  questions: ApplicationQuestion[];
  layout?: "single-card" | "cards";
}) {
  if (!answers || Object.keys(answers).length === 0) {
    return layout === "cards" ? (
      <p className="text-sm text-muted-foreground">{sl.leads.noAnswers}</p>
    ) : (
      <Card>
        <CardHeader>
          <CardTitle>{sl.leads.answers}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{sl.leads.noAnswers}</p>
        </CardContent>
      </Card>
    );
  }

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const known = Object.entries(answers).filter(([key]) => questionById.has(key));
  const archived = Object.entries(answers).filter(([key]) => !questionById.has(key));

  if (layout === "cards") {
    return (
      <div className="flex flex-col gap-3">
        {known.map(([key, value]) => (
          <div key={key}>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {questionById.get(key)?.label}
            </p>
            <p className="rounded-md bg-muted px-3 py-2.5 text-sm">{renderValue(value)}</p>
          </div>
        ))}
        {archived.length > 0 && (
          <div className="mt-1 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">{sl.leads.archivedAnswers}</p>
            <p className="mb-2 text-xs text-muted-foreground/70">{sl.leads.archivedAnswersHint}</p>
            {archived.map(([key, value]) => (
              <div key={key} className="mb-2">
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{key}</p>
                <p className="rounded-md bg-muted px-3 py-2.5 text-sm">{renderValue(value)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sl.leads.answers}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {known.map(([key, value]) => (
          <div key={key} className="text-sm">
            <p className="font-medium">{questionById.get(key)?.label}</p>
            <p className="text-muted-foreground">{renderValue(value)}</p>
          </div>
        ))}

        {archived.length > 0 && (
          <div className="mt-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">{sl.leads.archivedAnswers}</p>
            <p className="mb-2 text-xs text-muted-foreground/70">{sl.leads.archivedAnswersHint}</p>
            {archived.map(([key, value]) => (
              <div key={key} className="text-sm">
                <p className="font-medium">{key}</p>
                <p className="text-muted-foreground">{renderValue(value)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
