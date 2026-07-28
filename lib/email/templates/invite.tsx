import { Body, Container, Head, Heading, Html, Link, Preview, Text } from "@react-email/components";

interface InviteEmailProps {
  inviteLink: string;
}

// TODO: copy review — placeholder Slovenian copy, see plan doc's "Email copy" decision.
export function InviteEmail({ inviteLink }: InviteEmailProps) {
  return (
    <Html lang="sl">
      <Head />
      <Preview>Povabilo v Trener Growth Sistem</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f4f4f5", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "8px" }}>
          <Heading as="h2">Povabljeni ste v Trener Growth Sistem</Heading>
          <Text>Kliknite spodnjo povezavo, da ustvarite svoj račun.</Text>
          <Link href={inviteLink}>{inviteLink}</Link>
          <Text style={{ color: "#71717a", fontSize: "12px" }}>
            Povezava je veljavna 7 dni. Če povabila niste pričakovali, to sporočilo lahko prezrete.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
