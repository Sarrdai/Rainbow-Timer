"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface TimeUnitSwitchProps {
  mode: "hr" | "min" | "sec" | "auto-min" | "auto-sec";
  sliderMode: "hr" | "min" | "sec";
  onUnitChange: (unit: "hr" | "min" | "sec") => void;
  className?: string;
}

export function TimeUnitSwitch({ mode, sliderMode, onUnitChange, className }: TimeUnitSwitchProps) {
  const isAutoMin = mode === "auto-min";
  const isAutoSec = mode === "auto-sec";

  // Which label is the currently active/displayed mode (drives breathing)
  const isDisplayHr = mode === "hr";
  const isDisplayMin = mode === "min" || mode === "auto-min";
  const isDisplaySec = mode === "sec" || mode === "auto-sec";

  const sliderTranslate = sliderMode === "sec"
    ? "translate-x-[72px]"
    : sliderMode === "min"
    ? "translate-x-[36px]"
    : "translate-x-0";

  // Ring is at the auto-mode button position (fixed, not sliding)
  const autoRingTranslate = isAutoSec ? "translate-x-[72px]" : "translate-x-[36px]";

  return (
    <div
      className={cn(
        "relative flex h-8 w-[116px] cursor-pointer items-center rounded-full bg-[hsl(300,100%,97%)] p-0.5 shadow-md",
        className
      )}
    >
      {/* White fill indicator (slider, stays on original selected mode) */}
      <div
        className={cn(
          "absolute left-0.5 h-[calc(100%-4px)] w-[36px] rounded-full bg-background shadow-sm transition-transform duration-300 ease-in-out",
          sliderTranslate
        )}
      />

      {/* Auto-mode ring (same shape/size as slider, outline only, breathes) */}
      {(isAutoMin || isAutoSec) && (
        <div
          className={cn(
            "absolute left-0.5 h-[calc(100%-4px)] w-[36px] rounded-full border-2 border-background pointer-events-none",
            autoRingTranslate
          )}
        />
      )}

      {/* hr button */}
      <button
        onClick={() => onUnitChange("hr")}
        className={cn(
          "relative z-10 flex h-full w-[36px] items-center justify-center select-none text-sm font-bold transition-colors duration-300",
          sliderMode === "hr" ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className={cn(isDisplayHr && "animate-pulse-strong")}>hr</span>
      </button>

      {/* min button */}
      <button
        onClick={() => onUnitChange("min")}
        className={cn(
          "relative z-10 flex h-full w-[36px] items-center justify-center select-none text-sm font-bold transition-colors duration-300",
          (sliderMode === "min" || isAutoMin) ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className={cn(isDisplayMin && "animate-pulse-strong")}>min</span>
      </button>

      {/* sec button */}
      <button
        onClick={() => onUnitChange("sec")}
        className={cn(
          "relative z-10 flex h-full w-[36px] items-center justify-center select-none text-sm font-bold transition-colors duration-300",
          (sliderMode === "sec" || isAutoSec) ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className={cn(isDisplaySec && "animate-pulse-strong")}>sec</span>
      </button>
    </div>
  );
}
