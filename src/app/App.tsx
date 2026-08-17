import { useEffect, useRef, useState } from "react";
import { RouterProvider } from "react-router-dom";
import LoginGate from "../components/auth/LoginGate";
import { useGardenStore } from "../stores/gardenStore";
import { router } from "./router";

const PULL_REFRESH_THRESHOLD = 78;
const PULL_REFRESH_MAX = 112;
const APP_ASSET_PATTERN = /\/assets\/index-[^"']+\.js/;

function getCurrentAppAsset(): string {
  const scripts = Array.from(document.scripts);
  const assetScript = scripts.find((script) => APP_ASSET_PATTERN.test(script.src));
  return assetScript?.src.match(APP_ASSET_PATTERN)?.[0] ?? "";
}

function getLatestAppAssetFromHtml(html: string): string {
  return html.match(APP_ASSET_PATTERN)?.[0] ?? "";
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, button, a"));
}

function isScrollable(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
}

function isAtPullRefreshStart(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const mainPanel = document.querySelector<HTMLElement>(".main-panel");
  if (!mainPanel || !mainPanel.contains(target) || mainPanel.scrollTop > 0) return false;

  let current: Element | null = target;
  while (current && current !== mainPanel) {
    if (isScrollable(current) && current.scrollTop > 0) return false;
    current = current.parentElement;
  }

  return true;
}

function PullToRefresh({ onRefresh, disabled }: { onRefresh: () => Promise<void>; disabled: boolean }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const startTargetRef = useRef<EventTarget | null>(null);
  const pullDistanceRef = useRef(0);
  const trackingRef = useRef(false);
  const pullingRef = useRef(false);

  useEffect(() => {
    function resetPull() {
      startYRef.current = null;
      startTargetRef.current = null;
      trackingRef.current = false;
      pullingRef.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }

    function onTouchStart(event: TouchEvent) {
      if (disabled || refreshing || event.touches.length !== 1 || isInteractiveTarget(event.target)) return;
      if (!isAtPullRefreshStart(event.target)) return;
      startYRef.current = event.touches[0].clientY;
      startTargetRef.current = event.target;
      trackingRef.current = true;
      pullingRef.current = false;
    }

    function onTouchMove(event: TouchEvent) {
      if (!trackingRef.current || startYRef.current === null || event.touches.length !== 1) return;
      if (!isAtPullRefreshStart(startTargetRef.current)) {
        resetPull();
        return;
      }
      const delta = event.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        resetPull();
        return;
      }
      pullingRef.current = true;
      event.preventDefault();
      const nextDistance = Math.min(PULL_REFRESH_MAX, delta * 0.55);
      pullDistanceRef.current = nextDistance;
      setPullDistance(nextDistance);
    }

    function onTouchEnd() {
      if (!trackingRef.current) return;
      const shouldRefresh = pullingRef.current && pullDistanceRef.current >= PULL_REFRESH_THRESHOLD;
      resetPull();
      if (!shouldRefresh) return;
      setRefreshing(true);
      void onRefresh().finally(() => setRefreshing(false));
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", resetPull);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", resetPull);
    };
  }, [disabled, onRefresh, refreshing]);

  if (!pullDistance && !refreshing) return null;

  const ready = pullDistance >= PULL_REFRESH_THRESHOLD;

  return (
    <div className={`pull-refresh ${ready || refreshing ? "ready" : ""}`} style={{ transform: `translateY(${refreshing ? 12 : pullDistance - 48}px)` }}>
      {refreshing ? "새로고침 중..." : ready ? "놓으면 새로고침" : "아래로 당겨 새로고침"}
    </div>
  );
}

function UpdateBanner({ currentAsset, latestAsset }: { currentAsset: string; latestAsset: string }) {
  const [applying, setApplying] = useState(false);

  function applyUpdate() {
    setApplying(true);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("app-update", Date.now().toString());
    window.location.replace(nextUrl.toString());
  }

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span>{applying ? "업데이트 적용 중입니다..." : "새 업데이트가 있습니다. 최신 버전으로 다시 불러오세요."}</span>
      <small>{currentAsset.split("/").pop()} → {latestAsset.split("/").pop()}</small>
      <button className="secondary-button compact-action" type="button" onClick={applyUpdate} disabled={applying}>
        {applying ? "적용 중" : "업데이트 적용"}
      </button>
    </div>
  );
}

function AppContent() {
  const load = useGardenStore((state) => state.load);
  const loading = useGardenStore((state) => state.loading);
  const [latestAsset, setLatestAsset] = useState("");
  const currentAssetRef = useRef(getCurrentAppAsset());

  async function checkForUpdate() {
    try {
      const response = await fetch(`/?update-check=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      const html = await response.text();
      const nextAsset = getLatestAppAssetFromHtml(html);
      if (nextAsset && currentAssetRef.current && nextAsset !== currentAssetRef.current) {
        setLatestAsset(nextAsset);
      }
    } catch {
      // Update checks should never block ordinary app use.
    }
  }

  useEffect(() => {
    void load();
    void checkForUpdate();
  }, [load]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void checkForUpdate();
    }

    window.addEventListener("focus", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
    window.addEventListener("pageshow", checkForUpdate);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void checkForUpdate(), 5 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", checkForUpdate);
      window.removeEventListener("online", checkForUpdate);
      window.removeEventListener("pageshow", checkForUpdate);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  async function refreshAppData() {
    await Promise.all([load(), checkForUpdate()]);
  }

  return (
    <>
      <PullToRefresh onRefresh={refreshAppData} disabled={loading} />
      {latestAsset && <UpdateBanner currentAsset={currentAssetRef.current} latestAsset={latestAsset} />}
      {loading && <div className="loading-bar">데이터를 불러오는 중입니다.</div>}
      <RouterProvider router={router} />
    </>
  );
}

export default function App() {
  return (
    <LoginGate>
      <AppContent />
    </LoginGate>
  );
}
