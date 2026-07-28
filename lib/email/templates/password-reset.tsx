import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";

interface PasswordResetEmailProps {
  resetLink: string;
}

// TODO: copy review — placeholder Slovenian copy, see plan doc's "Email copy" decision.
export function PasswordResetEmail({ resetLink }: PasswordResetEmailProps) {
  return (
    <Html lang="sl">
      <Head />
      <Preview>Ponastavitev gesla — Trener Growth Sistem</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f4f4f5", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "8px" }}>
          <Heading as="h2">Ponastavitev gesla</Heading>
          <Text>Prejeli smo zahtevo za ponastavitev gesla. Kliknite spodnjo povezavo:</Text>
          <Link href={resetLink}>{resetLink}</Link>
          <Text style={{ color: "#71717a", fontSize: "12px" }}>
            Povezava je veljavna 60 minut. Če te zahteve niste poslali vi, to sporočilo lahko prezrete.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
