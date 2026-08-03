"use client";

import { Container } from "@/app/(public)/_components/container";
import { MotionPress } from "@/app/(public)/_components/motion-press";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";

const navLinks = [
  { href: "#sistem", label: "Sistem" },
  { href: "#kako-deluje", label: "Kako deluje" },
  { href: "#produkt", label: "Produkt" },
  { href: "#bonusi", label: "Bonusi" },
  { href: "#cenik", label: "Cenik" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [activeHref, setActiveHref] = useState<string | null>(null);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = navLinks
      .map((link) => document.querySelector(link.href))
      .filter((el): el is Element => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveHref(`#${visible.target.id}`);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <motion.header
      initial={{ y: -32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        scrolled ? "bg-background/90 shadow-sm ring-1 ring-foreground/10 backdrop-blur-md" : "bg-transparent",
      )}
    >
      <Container className="flex h-16 items-center justify-between">
        <a href="#" className="text-sm font-semibold tracking-tight text-foreground">
          <img src="images\brand\logo-tgs-nobg.png" alt="Trener Growth Sistem" className="h-12 w-auto" />
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => {
            const isActive = activeHref === link.href;
            return (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  "relative pb-1 text-sm font-medium transition-colors hover:text-hot",
                  isActive ? "text-hot" : "text-foreground/80",
                )}
              >
                {link.label}
                {isActive && (
                  <motion.span
                    layoutId="navbar-active-underline"
                    className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-hot"
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <MotionPress>
            <Button
              size="lg"
              nativeButton={false}
              render={<a href="#kontakt" />}
              className="bg-hot text-white hover:bg-hot/90"
            >
              Pošlji povpraševanje
            </Button>
          </MotionPress>
        </div>

        <Sheet>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="text-foreground md:hidden" />
            }
          >
            <Menu />
            <span className="sr-only">Odpri meni</span>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Meni</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {navLinks.map((link) => (
                <SheetClose
                  key={link.href}
                  nativeButton={false}
                  render={
                    <a
                      href={link.href}
                      className="rounded-lg px-2 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                    />
                  }
                >
                  {link.label}
                </SheetClose>
              ))}
            </nav>
            <div className="mt-auto p-4">
              <SheetClose
                nativeButton={false}
                render={
                  <a
                    href="#kontakt"
                    className="flex w-full items-center justify-center rounded-lg bg-hot px-4 py-3 text-base font-medium text-white hover:bg-hot/90"
                  />
                }
              >
                Pošlji povpraševanje
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </Container>
    </motion.header>
  );
}
