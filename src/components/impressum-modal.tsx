"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { X } from 'lucide-react';

interface ImpressumModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImpressumModal({ isOpen, onOpenChange }: ImpressumModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Impressum</AlertDialogTitle>
          <button 
            onClick={() => onOpenChange(false)} 
            className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Schließen</span>
          </button>
        </AlertDialogHeader>
        <AlertDialogDescription asChild>
          <div className="text-sm text-muted-foreground space-y-4">
            <div className="reverse-block">
              <span>GERMANY</span>
              <span>55758</span>
              <span>RENDSBURGER STR. 14</span>
              <span>PHILIPP KLEIN</span>
            </div>
            
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground">Kontakt</h3>
              <div className="reverse-block">
                <span>E-Mail:  mail+rainbow [at] kleinphilipp.de</span>
                <span>Telefon: +49 176 ACHT VIER VIER DREI DREI SECHS VIER ACHT</span>
              </div>
            </div>

            <p className="pt-2">
              Angaben gemäß § 5 TMG.
            </p>
          </div>
        </AlertDialogDescription>
        <AlertDialogFooter>
          {/* Footer can be empty or have actions */}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
