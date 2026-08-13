import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import LoginGate from "../components/auth/LoginGate";
import { useGardenStore } from "../stores/gardenStore";
import { router } from "./router";

function AppContent() {
  const load = useGardenStore((state) => state.load);
  const loading = useGardenStore((state) => state.loading);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
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
