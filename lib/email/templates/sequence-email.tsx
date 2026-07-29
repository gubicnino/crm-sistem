import type { ReactNode } from "react";
import { EmailLayout } from "@/lib/email/templates/layout";

interface SequenceEmailProps {
  bodyNodes: ReactNode[];
  unsubscribeLink: string;
}

export function SequenceEmail({ bodyNodes, unsubscribeLink }: SequenceEmailProps) {
  return <EmailLayout unsubscribeLink={unsubscribeLink}>{bodyNodes}</EmailLayout>;
}
