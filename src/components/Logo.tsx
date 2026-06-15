import React from "react";

interface LogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  horizontal?: boolean;
}

export default function Logo({
  className = "",
  iconClassName = "",
  textClassName = "",
  horizontal = false
}: LogoProps) {
  if (horizontal) {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <svg
          viewBox="0 0 100 45"
          className={`w-7 h-auto stroke-current fill-none text-brandBlack ${iconClassName}`}
          strokeWidth="7"
          strokeLinecap="round"
        >
          <path d="M 15 35 A 40 40 0 0 1 85 35" />
        </svg>
        <span
          className={`font-sans font-extrabold italic uppercase tracking-widest text-sm text-brandBlack leading-none ${textClassName}`}
        >
          ALPARFUME
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <svg
        viewBox="0 0 100 45"
        className={`w-20 md:w-24 h-auto stroke-current fill-none text-brandBlack ${iconClassName}`}
        strokeWidth="7"
        strokeLinecap="round"
      >
        <path d="M 15 35 A 40 40 0 0 1 85 35" />
      </svg>
      <span
        className={`font-sans font-extrabold italic uppercase tracking-[0.2em] text-2xl md:text-3xl text-brandBlack mt-2 leading-none ${textClassName}`}
      >
        ALPARFUME
      </span>
    </div>
  );
}
