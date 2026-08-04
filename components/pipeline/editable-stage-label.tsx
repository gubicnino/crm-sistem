"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { sl } from "@/lib/strings";
import { cn } from "@/lib/utils";

/**
 * Click-to-edit text, used for the Kanban column headers and the "lost"
 * panel header. Presentational only: reports a committed rename via
 * onSave and lets the parent own persistence/optimistic state, so this
 * component works the same whether the parent is mid-drag-and-drop
 * (KanbanBoard) or not.
 */
export function EditableStageLabel({
  label,
  onSave,
  disabled,
  className,
}: {
  label: string;
  onSave: (next: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);

  function commit() {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== label) {
      onSave(trimmed);
    } else {
      setValue(label);
    }
  }

  function cancel() {
    setValue(label);
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        maxLength={30}
        aria-label={sl.pipeline.renameStageAriaLabel(label)}
        className={cn("h-6 px-1.5 text-sm font-medium", className)}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEditing(true)}
      aria-label={sl.pipeline.renameStageAriaLabel(label)}
      className={cn(
        "rounded px-1 text-left hover:bg-foreground/5 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        className,
      )}
    >
      {label}
    </button>
  );
}
