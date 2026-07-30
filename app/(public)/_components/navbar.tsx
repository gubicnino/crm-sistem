"use client";

import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Container } from "@/app/(public)/_components/container";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#kako-deluje", label: "Kako deluje" },
  { href: "#bonusi", label: "Bonusi" },
  { href: "#cenik", label: "Cenik" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
        <a
          href="#"
          className={cn(
            "text-sm font-semibold tracking-tight transition-colors",
            scrolled ? "text-foreground" : "text-background",
          )}
        >
          Trener Growth
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-hot",
                scrolled ? "text-foreground/80" : "text-background/80",
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button
            size="sm"
            nativeButton={false}
            render={<a href="#kontakt" />}
            className="bg-hot text-white hover:bg-hot/90"
          >
            Povprašuj za dostop
          </Button>
        </div>

        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn("md:hidden", scrolled ? "text-foreground" : "text-background hover:bg-background/10")}
              />
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
                    className="flex w-full items-center justify-center rounded-lg bg-hot px-4 py-2.5 text-sm font-medium text-white hover:bg-hot/90"
                  />
                }
              >
                Povprašuj za dostop
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </Container>
    </motion.header>
  );
}
