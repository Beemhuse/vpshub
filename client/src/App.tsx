import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { Servers } from "./views/Servers";
import { ServerDetail } from "./views/ServerDetail";
import { Templates } from "./views/Templates";
import { Deployments } from "./views/Deployments";
import { Projects } from "./views/Projects";
import { Logs } from "./views/Logs";
import { Billing } from "./views/Billing";
import { Settings } from "./views/Settings";
import { ProjectDetail } from "./views/ProjectDetail";
import { DeploymentDetail } from "./views/DeploymentDetail";
import { DeployModal } from "./components/DeployModal";
import { GithubCallback } from "./views/GithubCallback";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "./store/authStore";
import { Login } from "./views/Login";

export interface Server {
  id: string;
  name: string;
  ip: string;
  os: string;
  status: "online" | "offline" | "warning";
  cpu: number;
  memory: number;
  disk: number;
  region: string;
}

export type View =
  | "lobby" // The server selection screen
  | "dashboard" // Server overview (ServerDetail)
  | "templates"
  | "deployments"
  | "projects"
  | "project-detail"
  | "deployment-detail"
  | "logs"
  | "billing"
  | "settings";

function App() {
  const { isAuthenticated } = useAuthStore();
  const [currentView, setCurrentView] = useState<View>(() => {
    const saved = localStorage.getItem("vpshub_currentView");
    return (saved as View) || "lobby";
  });

  const [selectedServer, setSelectedServer] = useState<Server | null>(() => {
    const saved = localStorage.getItem("vpshub_selectedServer");
    return saved ? JSON.parse(saved) : null;
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => {
      return localStorage.getItem("vpshub_selectedProjectId");
    },
  );

  const [selectedDeploymentId, setSelectedDeploymentId] = useState<
    string | null
  >(() => {
    return localStorage.getItem("vpshub_selectedDeploymentId");
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem("vpshub_currentView", currentView);
  }, [currentView]);

  useEffect(() => {
    if (selectedServer) {
      localStorage.setItem(
        "vpshub_selectedServer",
        JSON.stringify(selectedServer),
      );
    } else {
      localStorage.removeItem("vpshub_selectedServer");
    }
  }, [selectedServer]);

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem("vpshub_selectedProjectId", selectedProjectId);
    } else {
      localStorage.removeItem("vpshub_selectedProjectId");
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedDeploymentId) {
      localStorage.setItem("vpshub_selectedDeploymentId", selectedDeploymentId);
    } else {
      localStorage.removeItem("vpshub_selectedDeploymentId");
    }
  }, [selectedDeploymentId]);

  if (!isAuthenticated) {
    return (
      <>
        <Login />
        <Toaster />
      </>
    );
  }

  // Handle OAuth callback route
  if (window.location.pathname === "/github-callback") {
    return <GithubCallback />;
  }

  const handleServerClick = (server: Server) => {
    setSelectedServer(server);
    setCurrentView("dashboard");
  };

  const handleNavigate = (view: View) => {
    if (view === "lobby") {
      setSelectedServer(null);
    }
    setCurrentView(view);
  };

  const renderView = () => {
    // If no server is selected, force lobby unless it's billing/settings
    if (
      !selectedServer &&
      !["lobby", "billing", "settings"].includes(currentView)
    ) {
      return <Servers onServerClick={handleServerClick} />;
    }

    switch (currentView) {
      case "lobby":
        return <Servers onServerClick={handleServerClick} />;
      case "dashboard":
        return selectedServer ? (
          <ServerDetail server={selectedServer} />
        ) : (
          <Servers onServerClick={handleServerClick} />
        );
      case "templates":
        return (
          <Templates
            serverId={selectedServer!.id}
            onDeployClick={() => setDeployModalOpen(true)}
          />
        );
      case "deployments":
        return <Deployments serverId={selectedServer!.id} />;
      case "projects":
        return (
          <Projects
            serverId={selectedServer!.id}
            onProjectClick={(id: string) => {
              setSelectedProjectId(id);
              setCurrentView("project-detail");
            }}
          />
        );
      case "project-detail":
        return (
          <ProjectDetail
            projectId={selectedProjectId!}
            onBack={() => setCurrentView("projects")}
            onDeploymentClick={(id: string) => {
              setSelectedDeploymentId(id);
              setCurrentView("deployment-detail");
            }}
          />
        );
      case "deployment-detail":
        return (
          <DeploymentDetail
            deploymentId={selectedDeploymentId!}
            onBack={() => setCurrentView("project-detail")}
          />
        );
      case "logs":
        return <Logs serverId={selectedServer!.id} />;
      case "billing":
        return <Billing />;
      case "settings":
        return <Settings />;
      default:
        return <Servers onServerClick={handleServerClick} />;
    }
  };

  return (
    <div className="min-h-screen bg-dark grain-overlay">
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        selectedServer={selectedServer}
      />

      <div
        className={`transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}
      >
        <Header
          onDeployClick={() => setDeployModalOpen(true)}
          currentView={currentView}
          selectedServer={selectedServer}
          collapsed={sidebarCollapsed}
        />

        <main className="pt-16 min-h-screen">
          <div className="p-6">{renderView()}</div>
        </main>
      </div>

      <DeployModal
        open={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        serverId={selectedServer?.id}
      />

      <Toaster />
    </div>
  );
}

export default App;
