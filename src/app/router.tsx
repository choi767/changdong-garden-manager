import { createBrowserRouter, createHashRouter } from "react-router-dom";
import Layout from "../components/layout/Layout";
import HomePage from "../pages/HomePage/HomePage";
import BedDetailPage from "../pages/BedDetailPage/BedDetailPage";
import CreateManagementGroupPage from "../pages/CreateManagementGroupPage/CreateManagementGroupPage";
import ManagementSheetPage from "../pages/ManagementSheetPage/ManagementSheetPage";
import ManagementGroupsPage from "../pages/ManagementGroupsPage/ManagementGroupsPage";
import PlantDatabasePage from "../pages/PlantDatabasePage/PlantDatabasePage";
import ScheduleWorkPage from "../pages/ScheduleWorkPage/ScheduleWorkPage";
import ObservationOverviewPage from "../pages/ObservationOverviewPage/ObservationOverviewPage";
import PestOverviewPage from "../pages/PestOverviewPage/PestOverviewPage";
import HarvestOverviewPage from "../pages/HarvestOverviewPage/HarvestOverviewPage";
import PhotoOverviewPage from "../pages/PhotoOverviewPage/PhotoOverviewPage";
import EvaluationOverviewPage from "../pages/EvaluationOverviewPage/EvaluationOverviewPage";
import HistoryPage from "../pages/HistoryPage/HistoryPage";
import SettingsPage from "../pages/SettingsPage/SettingsPage";

const routes = [
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "beds/:bedId", element: <BedDetailPage /> },
      { path: "groups/new", element: <CreateManagementGroupPage /> },
      { path: "groups", element: <ManagementGroupsPage /> },
      { path: "sheets/:sheetId", element: <ManagementSheetPage /> },
      { path: "tasks", element: <ScheduleWorkPage /> },
      { path: "observations", element: <ObservationOverviewPage /> },
      { path: "pests", element: <PestOverviewPage /> },
      { path: "harvests", element: <HarvestOverviewPage /> },
      { path: "photos", element: <PhotoOverviewPage /> },
      { path: "evaluations", element: <EvaluationOverviewPage /> },
      { path: "plants", element: <PlantDatabasePage /> },
      { path: "history", element: <HistoryPage /> },
      { path: "settings", element: <SettingsPage /> }
    ]
  }
];

const needsPortableRouter = !["http:", "https:"].includes(window.location.protocol);

export const router = needsPortableRouter
  ? createHashRouter(routes)
  : createBrowserRouter(routes);
