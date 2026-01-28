"use client";

import { ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface ScrollToTopProps {
  /** Scroll threshold in pixels before showing the button */
  threshold?: number;
  className?: string;
}

const BUTTON_MARGIN = 16; // px - margin above footer

export function ScrollToTop({ threshold = 300, className }: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [extraOffset, setExtraOffset] = useState(0);

  useEffect(() => {
    function handleScroll() {
      setIsVisible(window.scrollY > threshold);

      // Check if footer is visible and adjust position (desktop only)
      const footer = document.querySelector("footer");
      if (footer) {
        // Check if footer is actually displayed (not hidden on mobile)
        const footerStyle = window.getComputedStyle(footer);
        if (footerStyle.display !== "none") {
          const footerRect = footer.getBoundingClientRect();
          const viewportHeight = window.innerHeight;

          if (footerRect.top < viewportHeight) {
            // Footer is visible - add extra offset
            const footerVisibleHeight = viewportHeight - footerRect.top;
            setExtraOffset(footerVisibleHeight + BUTTON_MARGIN);
          } else {
            setExtraOffset(0);
          }
        } else {
          // Footer is hidden (mobile) - no extra offset
          setExtraOffset(0);
        }
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // Base: bottom-24 (96px) on mobile to stay above BottomNav (h-16 = 64px)
  // Base: bottom-6 (24px) on desktop
  // Extra offset added when footer is visible
  const style = extraOffset > 0 ? { marginBottom: `${extraOffset}px` } : undefined;

  return (
    <button
      onClick={scrollToTop}
      style={{
        ...style,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
      className={cn(
        "fixed bottom-24 right-4 z-50 flex size-10 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:opacity-90 md:bottom-6 md:right-6",
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0",
        className
      )}
      aria-label="Retour en haut"
    >
      <ChevronUp className="size-5 text-white" strokeWidth={2} />
    </button>
  );
}
