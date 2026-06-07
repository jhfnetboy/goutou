"use client";

import { useEffect } from "react";

const BUILD_ID_STORAGE_KEY = "seeder-build-id";
const BUILD_ID_RELOAD_KEY = "seeder-build-reload";

async function readBuildId() {
  const response = await fetch(`/BUILD_ID?ts=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to read current build id.");
  }

  return (await response.text()).trim();
}

export function BuildRefreshGuard() {
  useEffect(() => {
    let isCancelled = false;

    async function syncBuildId() {
      try {
        const currentBuildId = await readBuildId();

        if (isCancelled || !currentBuildId) {
          return;
        }

        const previousBuildId = window.sessionStorage.getItem(
          BUILD_ID_STORAGE_KEY,
        );
        const reloadMarker = window.sessionStorage.getItem(BUILD_ID_RELOAD_KEY);

        if (
          previousBuildId &&
          previousBuildId !== currentBuildId &&
          reloadMarker !== currentBuildId
        ) {
          window.sessionStorage.setItem(BUILD_ID_STORAGE_KEY, currentBuildId);
          window.sessionStorage.setItem(BUILD_ID_RELOAD_KEY, currentBuildId);
          window.location.reload();
          return;
        }

        window.sessionStorage.setItem(BUILD_ID_STORAGE_KEY, currentBuildId);

        if (reloadMarker === currentBuildId) {
          window.sessionStorage.removeItem(BUILD_ID_RELOAD_KEY);
        }
      } catch {
        // Best effort only. If the build id cannot be read, do not interrupt the UI.
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncBuildId();
      }
    };

    void syncBuildId();
    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isCancelled = true;
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
