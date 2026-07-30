"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Container } from "@/app/(public)/_components/container";
import { MotionPress } from "@/app/(public)/_components/motion-press";
import { Stagger, StaggerItem } from "@/app/(public)/_components/stagger";
import { contactSchema, type ContactInput } from "@/lib/validation/contact";

export function ContactFooter() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({ resolver: zodResolver(contactSchema) });

  function onSubmit() {
    // UI-only for now — no backend endpoint yet, see
    // docs/superpowers/specs/2026-07-30-public-landing-page-design.md.
    setSubmitted(true);
    reset();
  }

  return (
    <section id="kontakt" className="bg-foreground text-background">
      <Container className="py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <Stagger>
            <StaggerItem>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Povprašuj za dostop
              </h2>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-4 max-w-sm text-background/70">
                Trenutno sprejemamo omejeno število trenerjev. Pusti svoje podatke in se oglasimo v
                24 urah.
              </p>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-8 text-sm text-background/50">
                Trener Growth Sistem · info@trenergrowth.si · +386 40 000 000
              </p>
            </StaggerItem>
          </Stagger>
          {submitted ? (
            <p className="rounded-2xl bg-background/10 p-6 text-background">
              Hvala! Sporočilo je bilo poslano — oglasimo se ti v najkrajšem možnem času.
            </p>
          ) : (
            <Stagger>
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <StaggerItem className="flex flex-col gap-1.5">
                  <Label htmlFor="contact-name" className="text-background/80">
                    Ime
                  </Label>
                  <Input
                    id="contact-name"
                    className="border-background/20 bg-background/5 text-background placeholder:text-background/40"
                    {...register("name")}
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </StaggerItem>
                <StaggerItem className="flex flex-col gap-1.5">
                  <Label htmlFor="contact-email" className="text-background/80">
                    E-pošta
                  </Label>
                  <Input
                    id="contact-email"
                    type="email"
                    className="border-background/20 bg-background/5 text-background placeholder:text-background/40"
                    {...register("email")}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </StaggerItem>
                <StaggerItem className="flex flex-col gap-1.5">
                  <Label htmlFor="contact-message" className="text-background/80">
                    Sporočilo
                  </Label>
                  <Textarea
                    id="contact-message"
                    rows={4}
                    className="border-background/20 bg-background/5 text-background placeholder:text-background/40"
                    {...register("message")}
                  />
                  {errors.message && (
                    <p className="text-sm text-destructive">{errors.message.message}</p>
                  )}
                </StaggerItem>
                <StaggerItem>
                  <MotionPress>
                    <Button
                      type="submit"
                      size="lg"
                      disabled={isSubmitting}
                      className="mt-2 bg-hot text-white hover:bg-hot/90"
                    >
                      Pošlji povpraševanje
                    </Button>
                  </MotionPress>
                </StaggerItem>
              </form>
            </Stagger>
          )}
        </div>
      </Container>
    </section>
  );
}
