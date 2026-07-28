import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApplicationQuestion, LeadAnswers } from "@/db/types";
import { sl } from "@/lib/strings";

function renderValue(value: LeadAnswers[string]): string {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export function AnswersView({
  answers,
  questions,
}: {
  answers: LeadAnswers | null;
  questions: ApplicationQuestion[];
}) {
  if (!answers || Object.keys(answers).length === 0) {
    return (
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
