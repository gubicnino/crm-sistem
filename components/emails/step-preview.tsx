"use client";

import type { ReactNode } from "react";
import type { EmailDocNode } from "@/db/types";
import { VARIABLE_LABELS } from "@/lib/email/tiptap-extensions";
import { substituteVariables } from "@/lib/email/variables";
import { sl } from "@/lib/strings";

function resolvePreviewVariable(name: string | undefined, trainerName: string): string {
  if (name === "trainerName") return trainerName;
  if (name === "leadName") return VARIABLE_LABELS.leadName;
  return "";
}

function renderInlineNode(node: EmailDocNode, trainerName: string, key: number): ReactNode {
  switch (node.type) {
    case "text": {
      let content: ReactNode = node.text ?? "";
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") content = <strong key={`b-${key}`}>{content}</strong>;
        else if (mark.type === "italic") content = <em key={`i-${key}`}>{content}</em>;
        else if (mark.type === "link" && mark.attrs?.href) {
          content = (
            <a
              key={`l-${key}`}
              href={mark.attrs.href}
              className="text-primary underline"
              onClick={(event) => event.preventDefault()}
            >
              {content}
            </a>
          );
        }
      }
      return <span key={key}>{content}</span>;
    }
    case "variable":
      return (
        <span key={key} className="font-medium">
          {resolvePreviewVariable(node.attrs?.name, trainerName)}
        </span>
      );
    case "hardBreak":
      return <br key={key} />;
    default:
      return null;
  }
}

function renderInline(nodes: EmailDocNode[] | undefined, trainerName: string): ReactNode[] {
  return (nodes ?? []).map((node, index) => renderInlineNode(node, trainerName, index));
}

function renderBlockNode(node: EmailDocNode, trainerName: string, key: number): ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} className="text-sm leading-relaxed text-foreground">
          {renderInline(node.content, trainerName)}
        </p>
      );
    case "heading": {
      const level = node.attrs?.level === 3 ? 3 : 2;
      const className = level === 2 ? "text-xl font-semibold text-foreground" : "text-lg font-semibold text-foreground";
      return level === 2 ? (
        <h2 key={key} className={className}>
          {renderInline(node.content, trainerName)}
        </h2>
      ) : (
        <h3 key={key} className={className}>
          {renderInline(node.content, trainerName)}
        </h3>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className="list-disc pl-5 text-sm leading-relaxed text-foreground">
          {(node.content ?? []).map((item, index) => (
            <li key={index}>{renderInline(item.content?.[0]?.content, trainerName)}</li>
          ))}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="list-decimal pl-5 text-sm leading-relaxed text-foreground">
          {(node.content ?? []).map((item, index) => (
            <li key={index}>{renderInline(item.content?.[0]?.content, trainerName)}</li>
          ))}
        </ol>
      );
    case "ctaButton":
      return (
        <span key={key} className="mt-3 inline-block rounded-md px-5 py-2.5 text-sm text-white" style={{ background: "#111827" }}>
          {node.attrs?.label}
        </span>
      );
    default:
      return null;
  }
}

/**
 * Live approximation of what a step's email looks like once sent — walks
 * the same EmailDocNode tree as lib/email/rich-text.tsx's
 * renderEmailDocBody, but into Tailwind HTML instead of @react-email
 * components: this is editing feedback, not the send-time renderer, and
 * intentionally does not reuse that renderer or add @react-email/render.
 */
export function StepPreview({ subject, body, trainerName }: { subject: string; body: EmailDocNode; trainerName: string }) {
  const previewSubject = substituteVariables(subject, { leadName: null, trainerName });
  return (
    <div className="rounded-lg bg-muted p-4">
      <div className="rounded-lg bg-card p-4 shadow-sm">
        <p className="mb-3 border-b pb-2 text-xs font-medium text-muted-foreground">
          {sl.emails.previewSubjectPrefix} {previewSubject}
        </p>
        <div className="flex flex-col gap-2">
          {(body.content ?? []).map((node, index) => renderBlockNode(node, trainerName, index))}
        </div>
        <p className="mt-6 text-[11px] text-muted-foreground">{sl.emails.previewFooterText}</p>
      </div>
    </div>
  );
}
