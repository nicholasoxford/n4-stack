"use client";

import * as React from "react";

import { ViewVerticalIcon } from "@radix-ui/react-icons";
import { Link, type LinkProps, useNavigate } from "@remix-run/react";
import { siteConfig } from "~/config/site";
import { cn } from "~/lib/utils";
import { Button } from "./ui/button";
import { Icons } from "./ui/icons";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";
import type { SupabaseClient } from "@supabase/supabase-js";

export function MobileNav({
  isAuthorized,
  supabase,
}: {
  isAuthorized: boolean;
  supabase: SupabaseClient<any, "public", any>;
}) {
  const [open, setOpen] = React.useState(false);

  const menuConfig = [
    {
      title: "Home",
      to: "/",
    },
    {
      title: "Chat",
      to: "/chat",
    },
    {
      title: "Request Area",
      to: "/docs/components",
    },
    {
      title: "About Us",
      to: "/examples",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
        >
          <ViewVerticalIcon className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
        <MobileLink to="/" className="flex items-center" onOpenChange={setOpen}>
          <Icons.logo className="mr-2 h-4 w-4" />
          <span className="font-bold">{siteConfig.name}</span>
        </MobileLink>
        <ScrollArea className="my-4 h-[calc(100vh-8rem)] pb-10 pl-6">
          <div className="flex flex-col space-y-3">
            {menuConfig?.map(
              (item) =>
                item.to && (
                  <MobileLink key={item.to} to={item.to} onOpenChange={setOpen}>
                    {item.title}
                  </MobileLink>
                )
            )}
            {isAuthorized && (
              <Button
                className="w-24 "
                onClick={async (_) => await supabase.auth.signOut()}
              >
                Logout
              </Button>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

interface MobileLinkProps extends LinkProps {
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

function MobileLink({
  to,
  onOpenChange,
  className,
  children,
  ...props
}: MobileLinkProps) {
  const navigate = useNavigate();

  return (
    <Link
      to={to}
      onClick={() => {
        navigate(to.toString());
        onOpenChange?.(false);
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </Link>
  );
}
