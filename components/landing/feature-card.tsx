"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Card de feature avec hover micro-interaction (scale + shadow).
 */
export function FeatureCard({ icon, iconBg, title, children, className }: FeatureCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.18, ease: "easeOut" } }}
      whileTap={{ scale: 0.985, transition: { duration: 0.12 } }}
      className={cn(
        "flex h-full flex-col rounded-xl border bg-card p-6 shadow-sm transition-shadow duration-200 hover:shadow-lg active:shadow-md",
        className
      )}
    >
      <div className={cn("mb-4 flex size-12 items-center justify-center rounded-lg", iconBg)}>
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-semibold tracking-tight">{title}</h3>
      <div className="text-muted-foreground">{children}</div>
    </motion.div>
  );
}
