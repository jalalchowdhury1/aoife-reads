"use client";
import type { ReactNode } from "react";

export type ButtonTone = "teal" | "rose" | "amber" | "plain";

const TONE_CLASSES: Record<ButtonTone, string> = {
  teal: "bg-teal-400 text-white active:bg-teal-600",
  rose: "bg-rose-400 text-white active:bg-rose-400/80",
  amber: "bg-amber-400 text-ink active:bg-amber-400/80",
  plain: "border-2 border-teal-400 bg-white text-ink active:bg-teal-100",
};

export function BigButton({
  children,
  onClick,
  disabled = false,
  tone = "teal",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: ButtonTone;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[72px] rounded-3xl px-8 font-bubble text-2xl shadow-lg transition active:scale-95 disabled:opacity-40 ${TONE_CLASSES[tone]}`}
    >
      {children}
    </button>
  );
}

export default BigButton;
