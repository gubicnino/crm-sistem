import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApplicationQuestion } from "@/db/types";
import { sl } from "@/lib/strings";

/**
 * Renders the CURRENT (unsaved) form values as an end-visitor would see them
 * — a pure function of live form state, never the saved server value, so it
 * stays honest while the trainer is mid-edit. Disabled/non-submittable: this
 * is a preview, not a second copy of the real public form.
 */
export function FormPreview({ questions }: { questions: ApplicationQuestion[] }) {
  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="text-sm">{sl.settings.previewTitle}</CardTitle>
        <p className="text-xs text-muted-foreground">{sl.settings.previewSubtitle}</p>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border bg-muted p-4">
          <p className="text-base font-semibold">{sl.settings.previewFormTitle}</p>
          <p className="mb-4 text-xs text-muted-foreground">{sl.settings.previewFormSubtitle}</p>
          <div className="flex flex-col gap-3">
            {questions.map((q, i) => (
              <div key={q.id || i}>
                {q.type === "checkbox" ? (
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <span className="size-3.5 rounded-sm border border-input bg-card" />
                    {q.label || sl.settings.previewUntitled}
                    {q.required && <span className="text-hot">*</span>}
                  </label>
                ) : (
                  <>
                    <p className="mb-1.5 flex gap-1 text-xs font-medium">
                      {q.label || sl.settings.previewUntitled}
                      {q.required && <span className="text-hot">*</span>}
                    </p>
                    {q.type === "select" ? (
                      <div className="flex items-center justify-between rounded-md border bg-card px-2.5 py-2 text-xs text-muted-foreground">
                        <span>{sl.settings.previewSelectPlaceholder}</span>
                        <span>⌄</span>
                      </div>
                    ) : (
                      <div
                        className={`rounded-md border bg-card px-2.5 text-xs text-muted-foreground ${q.type === "textarea" ? "py-6" : "py-2"}`}
                      >
                        {sl.settings.previewInputPlaceholder}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md bg-primary py-2 text-center text-xs font-semibold text-primary-foreground">
            {sl.settings.previewSubmit}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
