"use client";

import { motion } from "motion/react";
import { Github, Layers, Lock, Zap } from "lucide-react";

const stats = [
  {
    icon: Layers,
    value: "5",
    label: "types d'actions détectées",
  },
  {
    icon: Zap,
    value: "0€",
    label: "gratuit, sans CB",
  },
  {
    icon: Lock,
    value: "RGPD",
    label: "lecture seule, AES-256",
  },
  {
    icon: Github,
    value: "AGPL-3.0",
    label: "open source",
  },
];

export function StatsBar() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: "easeOut" }}
          className="flex items-center gap-3 rounded-xl border bg-card/60 px-4 py-3 backdrop-blur-sm"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/15 to-purple-500/15">
            <stat.icon className="size-4 text-brand" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold tabular-nums leading-none sm:text-lg">{stat.value}</div>
            <div className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{stat.label}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
