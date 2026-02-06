"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface TimeUnitSwitchProps {
  unit: "min" | "sec";
  onUnitChange: (unit: "min" | "sec") => void;
  className?: string;
}

export function TimeUnitSwitch({ unit, onUnitChange, className }: TimeUnitSwitchProps) {
  const isMin = unit === "min";

  return (
    <div
      onClick={(e) => e.stopPropagation()} // Prevent triggering drag on the timer
      className={cn(
        "relative flex h-8 w-20 cursor-pointer items-center rounded-full bg-[hsl(300,100%,97%)] p-0.5 shadow-md",
        className
      )}
    >
      {/* Sliding indicator */}
      <div
        className={cn(
          "absolute h-7 w-[38px] rounded-full bg-background shadow-sm transition-transform duration-300 ease-in-out",
          isMin ? "translate-x-0" : "translate-x-[38px]"
        )}
      />

      {/* Clickable areas and text */}
      <button
        onClick={() => onUnitChange("min")}
        className={cn(
          "relative z-10 flex h-full flex-1 items-center justify-center select-none text-sm font-bold transition-colors duration-300",
          isMin ? "text-foreground" : "text-muted-foreground"
        )}
      >
        min
      </button>

      <button
        onClick={() => onUnitChange("sec")}
        className={cn(
          "relative z-10 flex h-full flex-1 items-center justify-center select-none text-sm font-bold transition-colors duration-300",
          !isMin ? "text-foreground" : "text-muted-foreground"
        )}
      >
        sec
      </button>
    </div>
  );
}
