"use client";

import { useDraggable } from "@dnd-kit/core";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { Lead } from "@/db/schema";
import { cn } from "@/lib/utils";

export function LeadCard({ lead, disabled }: { lead: Lead; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab p-3 text-sm active:cursor-grabbing", isDragging && "z-10 opacity-50")}
    >
      <Link
        href={`/leads/${lead.id}`}
        className="font-medium hover:underline"
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
      >
        {lead.name ?? lead.email}
      </Link>
      <p className="truncate text-xs text-muted-foreground">{lead.email}</p>
    </Card>
  );
}
