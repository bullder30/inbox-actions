"use client";

import { motion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

type RevealVariant = "fade-up" | "fade-in" | "fade-left" | "fade-right" | "zoom-in";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  variant?: RevealVariant;
  /** Delay en ms (compat avec l'ancien ScrollReveal) */
  delay?: number;
}

const variants: Record<RevealVariant, Variants> = {
  "fade-up": {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0 },
  },
  "fade-in": {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  "fade-left": {
    hidden: { opacity: 0, x: -24 },
    visible: { opacity: 1, x: 0 },
  },
  "fade-right": {
    hidden: { opacity: 0, x: 24 },
    visible: { opacity: 1, x: 0 },
  },
  "zoom-in": {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1 },
  },
};

/**
 * Reveal scroll-triggered basé sur motion.
 * Remplace l'ancien ScrollReveal (IntersectionObserver custom).
 */
export function Reveal({ children, className, variant = "fade-up", delay = 0 }: RevealProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={variants[variant]}
      transition={{ duration: 0.5, ease: "easeOut", delay: delay / 1000 }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
