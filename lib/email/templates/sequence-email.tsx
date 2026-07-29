import { Heading, Text } from "@react-email/components";
import { EmailLayout } from "@/lib/email/templates/layout";

interface SequenceEmailProps {
  heading: string;
  paragraphs: string[];
  unsubscribeLink: string;
}

export function SequenceEmail({ heading, paragraphs, unsubscribeLink }: SequenceEmailProps) {
  return (
    <EmailLayout unsubscribeLink={unsubscribeLink}>
      <Heading as="h2">{heading}</Heading>
      {paragraphs.map((paragraph, index) => (
        // Index key is safe here: paragraphs render once per call and never
        // reorder within a single render — unlike a list a user edits live.
        <Text key={index}>{paragraph}</Text>
      ))}
    </EmailLayout>
  );
}
