import { Body, Container, Head, Heading, Html, Text } from "@react-email/components";

interface DailyDigestEmailProps {
  trainerName: string;
  newLeadsCount: number;
  stuckLeadsCount: number;
  orphanedCount: number;
  cancelFailedCount: number;
}

// TODO: copy review — placeholder Slovenian copy, see plan doc's "Email copy" decision.
export function DailyDigestEmail({
  trainerName,
  newLeadsCount,
  stuckLeadsCount,
  orphanedCount,
  cancelFailedCount,
}: DailyDigestEmailProps) {
  const hasWarnings = orphanedCount > 0 || cancelFailedCount > 0;

  return (
    <Html lang="sl">
      <Head />
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f4f4f5", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "8px" }}>
          <Heading as="h2">Dnevni pregled</Heading>
          <Text>Pozdravljeni, {trainerName},</Text>

          {newLeadsCount > 0 && (
            <Text>
              V zadnjih 24 urah ste prejeli <strong>{newLeadsCount}</strong>{" "}
              {newLeadsCount === 1 ? "novo stranko" : "novih strank"}.
            </Text>
          )}

          {stuckLeadsCount > 0 && (
            <Text>
              <strong>{stuckLeadsCount}</strong>{" "}
              {stuckLeadsCount === 1 ? "stranka že dalj časa čaka" : "strank že dalj časa čaka"} v isti fazi
              cevovoda — morda je čas za nadaljnji korak.
            </Text>
          )}

          {hasWarnings && (
            <>
              <Heading as="h3">Opozorila</Heading>
              {orphanedCount > 0 && (
                <Text>
                  {orphanedCount} {orphanedCount === 1 ? "e-sporočilo ni bilo" : "e-sporočil ni bilo"} mogoče
                  potrditi kot poslano in ne bo ponovno poskušeno — priporočamo ročni pregled.
                </Text>
              )}
              {cancelFailedCount > 0 && (
                <Text>
                  {cancelFailedCount} {cancelFailedCount === 1 ? "preklic ni uspel" : "preklicev ni uspelo"} — te
                  stranke bodo morda še vedno prejele e-sporočilo, ki bi moralo biti ustavljeno.
                </Text>
              )}
            </>
          )}
        </Container>
      </Body>
    </Html>
  );
}
