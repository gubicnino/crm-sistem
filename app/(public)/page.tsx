import { AudienceFit } from "@/app/(public)/_components/audience-fit";
import { BonusStack } from "@/app/(public)/_components/bonus-stack";
import { ContactFooter } from "@/app/(public)/_components/contact-footer";
import { Cta } from "@/app/(public)/_components/cta";
import { Faq } from "@/app/(public)/_components/faq";
import { Guarantee } from "@/app/(public)/_components/guarantee";
import { Hero } from "@/app/(public)/_components/hero";
import { MotionProvider } from "@/app/(public)/_components/motion-provider";
import { Navbar } from "@/app/(public)/_components/navbar";
import { ProductTour } from "@/app/(public)/_components/product-tour";
import { ProductWalkthrough } from "@/app/(public)/_components/product-walkthrough";
import { Reveal } from "@/app/(public)/_components/reveal";
import { ValueStack } from "@/app/(public)/_components/value-stack";

export default function Home() {
  return (
    <MotionProvider>
      <Navbar />
      <main>
        <Hero />
        <Reveal>
          <ProductWalkthrough />
        </Reveal>
        <Reveal>
          <ProductTour />
        </Reveal>
        <Reveal>
          <AudienceFit />
        </Reveal>
        <Reveal>
          <Guarantee />
        </Reveal>
        <Reveal>
          <BonusStack />
        </Reveal>
        <Reveal>
          <ValueStack />
        </Reveal>
        <Reveal>
          <Cta />
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
