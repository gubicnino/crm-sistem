import type { LeadSource, PipelineStage } from "@/db/schema";
import type { ScheduledEmailStatus } from "@/db/types";

/**
 * Exhaustive Record<enum, string> Tailwind className maps — sibling to
 * lib/labels.ts's text maps, same convention: adding a new enum value
 * without updating the matching map here is a compile error, not a silent
 * grey badge. Applied as <Badge variant="secondary" className={map[value]}>
 * — cn() puts className last, so tailwind-merge resolves the background and
 * text color override cleanly over the variant's default grey.
 */
export const pipelineStageBadgeClasses: Record<PipelineStage, string> = {
  email_lead: "bg-stage-1/15 text-stage-1-foreground",
  application_received: "bg-stage-2/15 text-stage-2-foreground",
  contacted: "bg-stage-3/15 text-stage-3-foreground",
  client: "bg-stage-4/15 text-stage-4-foreground",
  lost: "bg-destructive-tint text-destructive",
};

/** Solid dot color per stage — kanban column headers, funnel legends. */
export const pipelineStageDotClasses: Record<PipelineStage, string> = {
  email_lead: "bg-stage-1",
  application_received: "bg-stage-2",
  contacted: "bg-stage-3",
  client: "bg-stage-4",
  lost: "bg-destructive",
};

/** application = hot/orange (full application form), lead_magnet = cold/blue. */
export const leadSourceBadgeClasses: Record<LeadSource, string> = {
  application: "bg-hot-tint text-hot-foreground",
  lead_magnet: "bg-primary-tint text-primary-hover",
};

export const scheduledEmailStatusBadgeClasses: Record<ScheduledEmailStatus, string> = {
  pending: "bg-primary-tint text-primary-hover",
  scheduled: "bg-primary-tint text-primary-hover",
  sent: "bg-success-tint text-success",
  canceled: "bg-secondary text-muted-foreground line-through decoration-muted-foreground/50",
  orphaned: "bg-destructive-tint text-destructive",
  cancel_failed: "bg-destructive-tint text-destructive",
};
