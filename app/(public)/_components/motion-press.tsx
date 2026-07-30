"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function MotionPress({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
      {children}
    </motion.div>
  );
}
