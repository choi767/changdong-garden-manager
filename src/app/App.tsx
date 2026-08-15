import { useEffect, useRef, useState } from "react";
import { RouterProvider } from "react-router-dom";
import LoginGate from "../components/auth/LoginGate";
import { useGardenStore } from "../stores/gardenStore";
import { router } from "./router";

const PULL_REFRESH_THRESHOLD = 78;
const PULL_REFRESH_MAX = 112;

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

function AppContent() {
  const load = useGardenStore((state) => state.load);
  const loading = useGardenStore((state) => state.loading);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PullToRefresh onRefresh={load} disabled={loading} />
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
