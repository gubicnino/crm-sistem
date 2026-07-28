"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sl } from "@/lib/strings";

export function SiteKeyCard({ siteKey }: { siteKey: string }) {
  const [copied, setCopied] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.si";

  const snippet = `fetch("${appUrl}/api/leads", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    siteKey: "${siteKey}",
    source: "application", // or "lead_magnet"
    name: "...",
    email: "...",
    answers: { /* your question ids -> answers */ },
    website: "", // honeypot — leave this hidden input empty
  }),
});`;

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sl.settings.siteKeyTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{sl.settings.siteKeyHint}</p>
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-sm">{siteKey}</code>
          <Button type="button" size="sm" variant="outline" onClick={() => copy(siteKey)}>
            {copied ? sl.settings.copied : sl.settings.copyButton}
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{sl.settings.snippetTitle}</p>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{snippet}</pre>
        </div>
      </CardContent>
    </Card>
  );
}
