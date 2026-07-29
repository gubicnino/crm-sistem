import { Button, Heading, Link, Text } from "@react-email/components";
import type { ReactNode } from "react";
import type { EmailDocNode } from "@/db/types";
import type { SequenceRenderContext } from "@/lib/email/variables";

function resolveVariable(name: string | undefined, ctx: SequenceRenderContext): string {
  switch (name) {
    case "leadName":
      return ctx.leadName ?? "";
    case "trainerName":
      return ctx.trainerName;
    default:
      return "";
  }
}

/**
 * Inline-node renderer. `lib/validation/email-doc.ts` is what actually
 * enforces the allowed node/mark set before a document ever reaches this
 * function — this `switch`'s `default: return null` is the second,
 * cheaper layer: even a document that somehow bypassed validation (a bug,
 * a manual DB edit) can never render an arbitrary node here, it just
 * silently drops it.
 */
function renderInlineNode(node: EmailDocNode, ctx: SequenceRenderContext, key: number): ReactNode {
  switch (node.type) {
    case "text": {
      let content: ReactNode = node.text ?? "";
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") content = <strong key={`b-${key}`}>{content}</strong>;
        else if (mark.type === "italic") content = <em key={`i-${key}`}>{content}</em>;
        else if (mark.type === "link" && mark.attrs?.href) {
          content = (
            <Link key={`l-${key}`} href={mark.attrs.href}>
              {content}
            </Link>
          );
        }
      }
      return <span key={key}>{content}</span>;
    }
    case "variable":
      return <span key={key}>{resolveVariable(node.attrs?.name, ctx)}</span>;
    case "hardBreak":
      return <br key={key} />;
    default:
      return null;
  }
}

function renderInline(nodes: EmailDocNode[] | undefined, ctx: SequenceRenderContext): ReactNode[] {
  return (nodes ?? []).map((node, index) => renderInlineNode(node, ctx, index));
}

/** listItem content is always exactly one paragraph — see the schema doc in
 *  lib/validation/email-doc.ts — so each item renders as one marked line. */
function renderListItems(items: EmailDocNode[], ctx: SequenceRenderContext, marker: (index: number) => string): ReactNode[] {
  return items.map((item, index) => {
    const paragraph = item.content?.[0];
    return (
      <Text key={index} style={{ margin: "4px 0" }}>
        {marker(index)}
        {renderInline(paragraph?.content, ctx)}
      </Text>
    );
  });
}

function renderBlockNode(node: EmailDocNode, ctx: SequenceRenderContext, key: number): ReactNode {
  switch (node.type) {
    case "paragraph":
      return <Text key={key}>{renderInline(node.content, ctx)}</Text>;
    case "heading": {
      const level = node.attrs?.level === 3 ? 3 : 2;
      return (
        <Heading key={key} as={`h${level}`}>
          {renderInline(node.content, ctx)}
        </Heading>
      );
    }
    // Rendered as marked <Text> lines rather than <ul>/<ol><li> — real
    // native list markup is notoriously inconsistent across email clients
    // (Outlook's Word rendering engine in particular), so a line-per-item
    // with a text marker is the more robust choice for actual deliverability.
    case "bulletList":
      return <div key={key}>{renderListItems(node.content ?? [], ctx, () => "• ")}</div>;
    case "orderedList":
      return <div key={key}>{renderListItems(node.content ?? [], ctx, (index) => `${index + 1}. `)}</div>;
    case "ctaButton":
      return (
        <Button
          key={key}
          href={node.attrs?.href ?? "#"}
          style={{
            background: "#111827",
            color: "#ffffff",
            padding: "10px 20px",
            borderRadius: "6px",
            marginTop: "12px",
            display: "inline-block",
          }}
        >
          {node.attrs?.label}
        </Button>
      );
    default:
      return null;
  }
}

/** Renders a step's body (an EmailDoc, see db/types.ts) into the block
 *  elements lib/email/templates/sequence-email.tsx wraps in EmailLayout. */
export function renderEmailDocBody(doc: EmailDocNode, ctx: SequenceRenderContext): ReactNode[] {
  return (doc.content ?? []).map((node, index) => renderBlockNode(node, ctx, index));
}
