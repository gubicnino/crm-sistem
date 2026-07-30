"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Lead } from "@/db/schema";
import { leadSourceBadgeClasses } from "@/lib/badge-styles";
import { avatarTintClass, initials, relativeDate } from "@/lib/display";
import { leadSourceLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function LeadCard({
  lead,
  disabled,
  variant = "default",
}: {
  lead: Lead;
  disabled?: boolean;
  variant?: "default" | "lost";
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled,
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      size="sm"
      className={cn(
        "gap-2",
        isDragging && "z-10 opacity-50",
        variant === "lost" && "bg-destructive-tint/60 ring-destructive/15",
      )}
    >
      <div className="flex items-start justify-between gap-2 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar size="sm" className="shrink-0">
            <AvatarFallback className={variant === "lost" ? "bg-transparent text-destructive" : avatarTintClass(lead.id)}>
              {initials(lead.name, lead.email)}
            </AvatarFallback>
          </Avatar>
          <Link
            href={`/leads/${lead.id}`}
            className={cn("truncate text-sm font-medium hover:underline", variant === "lost" && "text-destructive")}
          >
            {lead.name ?? lead.email}
          </Link>
        </div>
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
          aria-label="Povleci"
        >
          <GripVertical className="size-3.5" />
        </button>
      </div>
      <p className={cn("truncate px-3 text-xs", variant === "lost" ? "text-destructive/70" : "text-muted-foreground")}>
        {lead.phone ?? lead.email}
      </p>
      <div className="flex items-center justify-between px-3">
        <Badge variant="secondary" className={cn("text-[10px]", leadSourceBadgeClasses[lead.source])}>
          {leadSourceLabels[lead.source]}
        </Badge>
        <span className="text-[11px] text-muted-foreground">{relativeDate(lead.createdAt)}</span>
      </div>
    </Card>
  );
}
