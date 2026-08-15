import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bug, CalendarCheck, Camera, Database, Eye, History, Home, Layers3, Leaf, PackageCheck, Settings, Star } from "lucide-react";
import Notice from "../common/Notice";

const navItems = [
  { to: "/", label: "홈", icon: Home },
  { to: "/groups", label: "그룹", icon: Layers3 },
  { to: "/tasks", label: "작업", icon: CalendarCheck },
  { to: "/observations", label: "관찰", icon: Eye },
  { to: "/pests", label: "병충", icon: Bug },
  { to: "/harvests", label: "수확", icon: PackageCheck },
  { to: "/photos", label: "사진", icon: Camera },
  { to: "/evaluations", label: "평가", icon: Star },
  { to: "/plants", label: "DB", icon: Leaf },
  { to: "/history", label: "과거", icon: History },
  { to: "/settings", label: "설정", icon: Settings }
];

function isActivePath(pathname: string, target: string): boolean {
  return target === "/" ? pathname === "/" : pathname.startsWith(target);
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Database size={24} aria-hidden="true" />
          <div>
            <strong>창동 틀밭관리</strong>
            <span>v2.0 Local</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="주 메뉴">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(location.pathname, item.to);
            return (
              <button
                key={item.to}
                type="button"
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
                onClick={() => navigate(item.to)}
              >
                <Icon size={20} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <p className="app-copyright">© 2026 창동 틀밭농장. All rights reserved.</p>
      </aside>
      <main className="main-panel">
        <Notice />
        <Outlet />
      </main>
    </div>
  );
}
