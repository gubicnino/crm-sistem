import { Heading, Text } from "@react-email/components";
import { COPY } from "@/lib/email/copy";
import type { SequenceContext, TemplateKey } from "@/lib/email/sequences";
import { EmailLayout } from "@/lib/email/templates/layout";

interface SequenceEmailProps extends SequenceContext {
  template: TemplateKey;
  unsubscribeLink: string;
}

export function SequenceEmail({ template, unsubscribeLink, ...ctx }: SequenceEmailProps) {
  const { heading, paragraphs } = COPY[template](ctx);
  return (
    <EmailLayout unsubscribeLink={unsubscribeLink}>
      <Heading as="h2">{heading}</Heading>
      {paragraphs.map((paragraph) => (
        <Text key={paragraph}>{paragraph}</Text>
      ))}
    </EmailLayout>
  );
}
