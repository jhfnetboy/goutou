"use client";

import { type ReactNode, useState } from "react";
import { CircleNotch, Power } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  className?: string;
  children?: ReactNode;
};

export function SignOutButton({ className, children }: SignOutButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={async () => {
        setIsPending(true);
        await authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/sign-in");
              router.refresh();
            },
          },
        });
      }}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[13px] font-medium text-foreground transition hover:border-border-strong hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {isPending ? (
        <>
          <CircleNotch className="size-4 animate-spin" />
          Signing out...
        </>
      ) : (
        children ?? (
          <>
            <Power className="size-4" />
            Sign Out
          </>
        )
      )}
    </button>
  );
}
