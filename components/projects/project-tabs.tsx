"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChatCircleText,
  ClockCounterClockwise,
  Kanban,
  NotePencil,
  SlidersHorizontal,
  SquaresFour,
  UsersThree,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

type ProjectTabsProps = {
  projectId: string;
};

const tabs = [
  { label: "Overview", icon: SquaresFour, suffix: "" },
  { label: "Requests", icon: ChatCircleText, suffix: "/requests" },
  { label: "Board", icon: Kanban, suffix: "/board" },
  { label: "Notes", icon: NotePencil, suffix: "/notes" },
  { label: "History", icon: ClockCounterClockwise, suffix: "/history" },
  { label: "Members", icon: UsersThree, suffix: "/settings/members" },
  { label: "Settings", icon: SlidersHorizontal, suffix: "/settings" },
] as const;

export function ProjectTabs({ projectId }: ProjectTabsProps) {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const href = `/projects/${projectId}${tab.suffix}`;
        const isActive = pathname === href;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-[13px] font-medium transition",
              isActive
                ? "border-border-strong bg-surface-strong text-foreground"
                : "border-border bg-surface text-muted hover:border-border-strong hover:bg-surface-strong hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
