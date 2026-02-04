"use client";

import React, { useState } from 'react';
import { ImpressumModal } from './impressum-modal';

export function Footer() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <footer className="footer-container">
        <a 
          href="https://buymeacoffee.com/kleinphilipp" 
          target="_blank" 
          rel="noopener noreferrer"
          className="impressum-link justify-self-end"
        >
          support
        </a>
        <span role="img" aria-label="rainbow" className="text-xs">🌈</span>
        <button onClick={() => setIsModalOpen(true)} className="impressum-link justify-self-start">
          impressum
        </button>
      </footer>
      <ImpressumModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  );
}
