"use client";

import { cn } from "@/lib/utils";
import React from "react";

interface TimeUnitSwitchProps {
  mode: "hr" | "min" | "sec" | "auto-min" | "auto-sec";
  onUnitChange: (unit: "hr" | "min" | "sec") => void;
  className?: string;
}

export function TimeUnitSwitch({ mode, onUnitChange, className }: TimeUnitSwitchProps) {
  const isPhysicallyOnHr = mode === "hr";
  const isPhysicallyOnMin = mode === "min" || mode === "auto-min";
  const isPhysicallyOnSec = mode === "sec" || mode === "auto-sec";

  const isAutoMin = mode === "auto-min";
  const isAutoSec = mode === "auto-sec";

  const sliderTranslate = isPhysicallyOnSec
    ? "translate-x-[76px]"
    : isPhysicallyOnMin
    ? "translate-x-[38px]"
    : "translate-x-0";

  return (
    <div
      className={cn(
        "relative flex h-8 w-[116px] cursor-pointer items-center rounded-full bg-[hsl(300,100%,97%)] p-0.5 shadow-md",
        className
      )}
    >
      {/* Sliding indicator */}
      <div
        className={cn(
          "absolute h-[calc(100%-4px)] w-[36px] rounded-full bg-background shadow-sm transition-transform duration-300 ease-in-out",
          sliderTranslate
        )}
      />

      {/* hr button */}
      <button
        onClick={() => onUnitChange("hr")}
        className={cn(
          "relative z-10 flex h-full w-[36px] items-center justify-center select-none text-sm font-bold transition-colors duration-300",
          isPhysicallyOnHr ? "text-foreground" : "text-muted-foreground"
        )}
      >
        hr
      </button>

      {/* min button */}
      <button
        onClick={() => onUnitChange("min")}
        className={cn(
          "relative z-10 flex h-full w-[36px] items-center justify-center select-none text-sm font-bold transition-colors duration-300",
          isPhysicallyOnMin ? "text-foreground" : "text-muted-foreground",
          isAutoMin && "animate-pulse-strong text-foreground"
        )}
      >
        min
      </button>

      {/* sec button */}
      <button
        onClick={() => onUnitChange("sec")}
        className={cn(
          "relative z-10 flex h-full w-[36px] items-center justify-center select-none text-sm font-bold transition-colors duration-300",
          isPhysicallyOnSec ? "text-foreground" : "text-muted-foreground",
          isAutoSec && "animate-pulse-strong text-foreground"
        )}
      >
        sec
      </button>
    </div>
  );
}
