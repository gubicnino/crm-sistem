import { Body, Container, Head, Html, Link, Text } from "@react-email/components";
import type { ReactNode } from "react";

interface EmailLayoutProps {
  children: ReactNode;
  unsubscribeLink: string;
}

/**
 * Shared wrapper for every sequence email — the unsubscribe link lives here,
 * in the footer, so it cannot be omitted per-template (CLAUDE.md: cancellation
 * on unsubscribe is mandatory, not optional).
 */
export function EmailLayout({ children, unsubscribeLink }: EmailLayoutProps) {
  return (
    <Html lang="sl">
      <Head />
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f4f4f5", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "8px" }}>
          {children}
          <Text style={{ color: "#a1a1aa", fontSize: "11px", marginTop: "32px" }}>
            Če ne želite več prejemati teh e-sporočil, se{" "}
            <Link href={unsubscribeLink}>odjavite tukaj</Link>.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
