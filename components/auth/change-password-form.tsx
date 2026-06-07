"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle, CircleNotch, LockKey } from "@phosphor-icons/react";

import { authClient } from "@/lib/auth-client";

type ChangePasswordFormProps = {
  closeHref?: string;
  onClose?: () => void;
};

const fieldClassName =
  "ui-input";

export function ChangePasswordForm({
  closeHref,
  onClose,
}: ChangePasswordFormProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirmation do not match.");
      return;
    }

    startTransition(async () => {
      const result = await authClient.changePassword(
        {
          currentPassword,
          newPassword,
          revokeOtherSessions,
        },
        {
          onSuccess: () => {
            setSuccessMessage("Password updated.");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");

            window.setTimeout(() => {
              if (onClose) {
                onClose();
              } else if (closeHref) {
                router.push(closeHref, { scroll: false });
              }
              router.refresh();
            }, 700);
          },
        },
      );

      if (result.error) {
        setErrorMessage(result.error.message ?? "Unable to change password.");
      }
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
      className="grid gap-4"
    >
      <label className="grid gap-2">
        <span className="text-sm font-medium text-foreground">
          Current password
        </span>
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className={fieldClassName}
          placeholder="Enter your current password"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">
            New password
          </span>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className={fieldClassName}
            placeholder="At least 8 characters"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-foreground">
            Confirm password
          </span>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={fieldClassName}
            placeholder="Repeat the new password"
          />
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3">
        <input
          type="checkbox"
          checked={revokeOtherSessions}
          onChange={(event) => setRevokeOtherSessions(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent"
        />
        <div>
          <p className="text-sm font-medium text-foreground">
            Revoke other sessions
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Recommended after a reset. Your current session will stay active.
          </p>
        </div>
      </label>

      {errorMessage ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 text-sm text-foreground">
          <CheckCircle className="size-5 text-accent" />
          {successMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="ui-button-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? <CircleNotch className="size-4 animate-spin" /> : <LockKey className="size-4" />}
        Update password
      </button>
    </form>
  );
}
