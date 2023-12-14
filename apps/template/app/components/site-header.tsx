/* eslint-disable react/jsx-pascal-case */
import { Link } from "@remix-run/react";
import { Button, buttonVariants } from "./ui/button";
import { cn } from "~/lib/utils";
import { Icons } from "./ui/icons";
import { siteConfig } from "~/config/site";
import { MainNav } from "./main-nav";
import { MobileNav } from "./mobile-nav";
import type { SupabaseClient } from "@supabase/supabase-js";

export function SiteHeader({
  isAuthorized,
  supabase,
}: {
  isAuthorized: boolean;
  supabase: SupabaseClient<any, "public", any>;
}) {
  return (
    <header className="supports-backdrop-blur:bg-background/60 sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="container flex h-14 items-center">
        <MainNav />
        <MobileNav isAuthorized={isAuthorized} supabase={supabase} />
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav className="flex items-center">
            <Link to={siteConfig.links.github} target="_blank" rel="noreferrer">
              <div
                className={cn(
                  buttonVariants({
                    variant: "ghost",
                  }),
                  "w-9 px-0"
                )}
              >
                <Icons.gitHub className="h-4 w-4" />
                <span className="sr-only">GitHub</span>
              </div>
            </Link>
            <Link
              to={siteConfig.links.twitter}
              target="_blank"
              rel="noreferrer"
            >
              <div
                className={cn(
                  buttonVariants({
                    variant: "ghost",
                  }),
                  "w-9 px-0"
                )}
              >
                <Icons.twitter className="h-4 w-4 fill-current" />
                <span className="sr-only">Twitter</span>
              </div>
            </Link>
            {isAuthorized && (
              <Button
                className="w-24 hidden md:block"
                onClick={async (_) => await supabase.auth.signOut()}
              >
                Logout
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
