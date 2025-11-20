import React from 'react';
import { Mic } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="w-full py-8 px-4 flex flex-col items-center justify-center text-center space-y-4">
      <div className="border-2 border-natgeo-yellow p-3 rounded-full shadow-[0_0_15px_rgba(255,199,0,0.3)]">
        <Mic className="w-8 h-8 text-natgeo-yellow" />
      </div>
      <h1 className="text-4xl md:text-5xl font-serif font-bold text-white tracking-tight">
        Aawaz <span className="text-natgeo-yellow">.</span>
      </h1>
      <p className="text-natgeo-light/60 max-w-lg text-sm md:text-base font-light tracking-wide">
        Generate cinematic, documentary-style narration powered by Gemini.
        <br />
        <span className="text-xs text-natgeo-yellow/80 mt-2 block">DEEP VOICE • HINDI RHYTHM • EMOTIONAL</span>
      </p>
    </header>
  );
};

export default Header;
