"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface TimeUnitSwitchProps {
  mode: "min" | "sec" | "auto-sec";
  onUnitChange: (unit: "min" | "sec") => void;
  className?: string;
}

export function TimeUnitSwitch({ mode, onUnitChange, className }: TimeUnitSwitchProps) {
  // In `auto-sec` mode, the switch physically remains on 'min', while 'sec' pulses.
  const isPhysicallyOnSec = mode === "sec";

  // The 'min' text is active when the slider is physically on 'min'.
  const isMinTextActive = !isPhysicallyOnSec;
  
  // The 'sec' text is active only when the slider is physically on 'sec'.
  const isSecTextActive = isPhysicallyOnSec;
  
  const isAutoSec = mode === 'auto-sec';

  return (
    <div
      className={cn(
        "relative flex h-8 w-20 cursor-pointer items-center rounded-full bg-[hsl(300,100%,97%)] p-0.5 shadow-md",
        className
      )}
    >
      {/* Sliding indicator */}
      <div
        className={cn(
          "absolute h-7 w-[38px] rounded-full bg-background shadow-sm transition-transform duration-300 ease-in-out",
          isPhysicallyOnSec ? "translate-x-[38px]" : "translate-x-0"
        )}
      />

      {/* Clickable areas and text */}
      <button
        onClick={() => onUnitChange("min")}
        className={cn(
          "relative z-10 flex h-full flex-1 items-center justify-center select-none text-sm font-bold transition-colors duration-300",
          isMinTextActive ? "text-foreground" : "text-muted-foreground"
        )}
      >
        min
      </button>

      <button
        onClick={() => onUnitChange("sec")}
        className={cn(
          "relative z-10 flex h-full flex-1 items-center justify-center select-none text-sm font-bold transition-colors duration-300",
          isSecTextActive ? "text-foreground" : "text-muted-foreground",
          // When in auto-sec mode, the 'sec' text pulses with the active color to indicate a temporary state.
          isAutoSec && "animate-pulse-strong text-foreground"
        )}
      >
        sec
      </button>
    </div>
  );
}
