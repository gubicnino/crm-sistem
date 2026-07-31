import { AudienceFit } from "@/app/(public)/_components/audience-fit";
import { BonusStack } from "@/app/(public)/_components/bonus-stack";
import { ContactFooter } from "@/app/(public)/_components/contact-footer";
import { Faq } from "@/app/(public)/_components/faq";
import { Guarantee } from "@/app/(public)/_components/guarantee";
import { Hero } from "@/app/(public)/_components/hero";
import { Mechanism } from "@/app/(public)/_components/mechanism";
import { MotionProvider } from "@/app/(public)/_components/motion-provider";
import { Navbar } from "@/app/(public)/_components/navbar";
import { Pricing } from "@/app/(public)/_components/pricing";
import { ProductTour } from "@/app/(public)/_components/product-tour";
import { Reveal } from "@/app/(public)/_components/reveal";
import { ValueStack } from "@/app/(public)/_components/value-stack";

export default function Home() {
  return (
    <MotionProvider>
      <Navbar />
      <main>
        <Hero />
        <Reveal>
          <Mechanism />
        </Reveal>
        <Reveal>
          <ProductTour />
        </Reveal>
        <Reveal>
          <AudienceFit />
        </Reveal>
        <Reveal>
          <BonusStack />
        </Reveal>
        <Reveal>
          <ValueStack />
        </Reveal>
        <Reveal>
          <Guarantee />
        </Reveal>
        <Reveal>
          <Pricing />
        </Reveal>
        <Reveal>
          <Faq />
        </Reveal>
        <Reveal>
          <ContactFooter />
        </Reveal>
      </main>
    </MotionProvider>
  );
}
