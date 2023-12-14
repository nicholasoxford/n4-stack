"use client";

import { useNavigation } from "@remix-run/react";
import { siteConfig } from "~/config/site";
import { cn } from "~/lib/utils";

export function MainNav() {
  const { location } = useNavigation();
  const pathname = location?.pathname;
  return (
    <div className="mr-4 hidden md:flex container">
      <a href="/" className="mr-6 flex items-center space-x-2">
        <span className="hidden font-bold sm:inline-block">
          {siteConfig.name}
        </span>
      </a>
      <nav className="flex items-center space-x-6 text-sm font-medium">
        <a
          href="/about"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname?.startsWith("/about")
              ? "text-foreground"
              : "text-foreground/60"
          )}
        >
          About
        </a>
      </nav>
    </div>
  );
}
