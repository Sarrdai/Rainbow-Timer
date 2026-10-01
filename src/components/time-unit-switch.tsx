"use client";

import { cn } from "@/lib/utils";
import React, { memo } from "react";

type Unit = "hr" | "min" | "sec";

interface TimeUnitSwitchProps {
  /** Unit currently shown on the dial; auto-* when the countdown switched by itself */
  mode: Unit | "auto-min" | "auto-sec";
  /** Unit the user selected (the white indicator stays here during auto modes) */
  sliderMode: Unit;
  onUnitChange: (unit: Unit) => void;
  className?: string;
}

const UNITS: Unit[] = ["hr", "min", "sec"];
const SEGMENT_PX = 48;

export const TimeUnitSwitch = memo(function TimeUnitSwitch({ mode, sliderMode, onUnitChange, className }: TimeUnitSwitchProps) {
  const autoUnit: Unit | null = mode === "auto-min" ? "min" : mode === "auto-sec" ? "sec" : null;

  return (
    <div
      role="radiogroup"
      aria-label="Time unit"
      className={cn("relative flex rounded-full p-[3px] text-sm font-bold", className)}
      style={{ background: "var(--segment-bg)" }}
    >
      {/* Selected indicator: compositor-only slide */}
      <span
        aria-hidden="true"
        className="absolute left-[3px] top-[3px] h-[calc(100%-6px)] rounded-full shadow-[0_1px_3px_var(--control-shadow)] transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ width: SEGMENT_PX, background: "var(--segment-active)", transform: `translateX(${UNITS.indexOf(sliderMode) * SEGMENT_PX}px)` }}
      />
      {/* Auto mode: outline marks the unit the dial switched to */}
      {autoUnit && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[3px] top-[3px] h-[calc(100%-6px)] rounded-full border-2"
          style={{ width: SEGMENT_PX, borderColor: "var(--segment-active-text)", opacity: 0.45, transform: `translateX(${UNITS.indexOf(autoUnit) * SEGMENT_PX}px)` }}
        />
      )}
      {UNITS.map((unit) => {
        const highlighted = unit === sliderMode || unit === autoUnit;
        return (
          <button
            key={unit}
            type="button"
            role="radio"
            aria-checked={unit === sliderMode}
            aria-label={unit === "hr" ? "Hours" : unit === "min" ? "Minutes" : "Seconds"}
            onClick={() => onUnitChange(unit)}
            className="relative z-10 flex h-[38px] select-none items-center justify-center rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ width: SEGMENT_PX, color: highlighted ? "var(--segment-active-text)" : "var(--segment-text)" }}
          >
            {unit}
          </button>
        );
      })}
    </div>
  );
});
