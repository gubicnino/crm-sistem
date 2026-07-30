import { AudienceFit } from "@/app/(public)/_components/audience-fit";
import { BonusStack } from "@/app/(public)/_components/bonus-stack";
import { ContactFooter } from "@/app/(public)/_components/contact-footer";
import { Faq } from "@/app/(public)/_components/faq";
import { Guarantee } from "@/app/(public)/_components/guarantee";
import { Hero } from "@/app/(public)/_components/hero";
import { Mechanism } from "@/app/(public)/_components/mechanism";
import { Pricing } from "@/app/(public)/_components/pricing";
import { ValueStack } from "@/app/(public)/_components/value-stack";

export default function Home() {
  return (
    <main>
      <Hero />
      <Mechanism />
      <AudienceFit />
      <BonusStack />
      <ValueStack />
      <Guarantee />
      <Pricing />
      <Faq />
      <ContactFooter />
    </main>
  );
}
