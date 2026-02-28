import {
  ArrowLeft,
  Settings,
  Rocket,
  Trash2,
  History,
  GitBranch,
  Globe,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProject, useProjectMutations } from "../hooks/useApi";
import { DeployTemplateModal } from "../components/DeployTemplateModal";
import { toast } from "sonner";
import { useState } from "react";

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onDeploymentClick: (id: string) => void;
}

export function ProjectDetail({
  projectId,
  onBack,
  onDeploymentClick,
}: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "deployments" | "settings"
  >("overview");
  const { data: project, isLoading } = useProject(projectId);
  const { deleteProject, isDeleting } = useProjectMutations();
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-violet animate-spin" />
        <p className="text-muted-foreground">Loading project details...</p>
      </div>
    );
  }

  if (!project) return null;

  const handleDelete = async () => {
    if (
      confirm(
        "Are you sure you want to delete this project? All associated deployments will be removed from the server.",
      )
    ) {
      try {
        await deleteProject(projectId);
        toast.success("Project deleted successfully");
        onBack();
      } catch (error) {
        toast.error("Failed to delete project");
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "text-success bg-success/20 border-success/30";
      case "pending":
        return "text-warning bg-warning/20 border-warning/30";
      case "failed":
        return "text-destructive bg-destructive/20 border-destructive/30";
      case "in-progress":
        return "text-violet bg-violet/20 border-violet/30 animate-pulse";
      default:
        return "text-muted-foreground bg-white/10";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">
                {project.name}
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-violet/20 border border-violet/30 text-[10px] font-medium text-violet uppercase tracking-wider">
                {project.type}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {project.description || "Project lifecycle management"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting}
            className="border-white/10 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button
            onClick={() => setIsDeployModalOpen(true)}
            className="bg-violet hover:bg-violet-600 text-white shadow-glow"
          >
            <Rocket className="w-4 h-4 mr-2" />
            Redeploy
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl w-fit border border-white/10">
        {[
          { id: "overview", label: "Overview", icon: History },
          { id: "deployments", label: "Deployments", icon: Rocket },
          { id: "settings", label: "Settings", icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-violet text-white shadow-lg"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {activeTab === "overview" && (
          <>
            <div className="col-span-8 space-y-6">
              {/* Latest Deployment Status */}
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
                  Latest Status
                </h3>
                {project.deployments?.[0] ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "w-3 h-3 rounded-full",
                          project.deployments[0].status === "completed"
                            ? "bg-success shadow-[0_0_12px_rgba(34,197,94,0.5)]"
                            : project.deployments[0].status === "failed"
                              ? "bg-destructive shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                              : "bg-violet animate-pulse shadow-[0_0_12px_rgba(139,92,246,0.5)]",
                        )}
                      />
                      <div>
                        <p className="font-medium text-foreground">
                          {project.deployments[0].status.toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Deployed{" "}
                          {new Date(
                            project.deployments[0].createdAt,
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        onDeploymentClick(project.deployments[0].id)
                      }
                      className="text-violet hover:bg-violet/10 group"
                    >
                      View Logs
                      <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6 text-center">
                    <AlertCircle className="w-8 h-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No deployments yet
                    </p>
                  </div>
                )}
              </div>

              {/* Source Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-violet/20 flex items-center justify-center">
                      <GitBranch className="w-4 h-4 text-violet" />
                    </div>
                    <span className="text-sm font-medium">Source</span>
                  </div>
                  <p className="text-sm text-foreground font-mono truncate bg-black/20 p-2 rounded border border-white/5">
                    {project.repositoryUrl || "No GitHub link"}
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center">
                      <Globe className="w-4 h-4 text-success" />
                    </div>
                    <span className="text-sm font-medium">Domain</span>
                  </div>
                  <p className="text-sm text-foreground truncate">
                    {project.domain || project.deployments?.[0]?.domain || "Not configured"}
                  </p>
                </div>
              </div>
            </div>

            <div className="col-span-4 space-y-6">
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
                  Application Stats
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Uptime
                    </span>
                    <span className="text-sm text-foreground font-medium">
                      99.9%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Requests/min
                    </span>
                    <span className="text-sm text-foreground font-medium">
                      1.2k
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Last Error
                    </span>
                    <span className="text-sm text-muted-foreground italic">
                      None recorded
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "deployments" && (
          <div className="col-span-12">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase">
                      ID
                    </th>
                    <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase">
                      Status
                    </th>
                    <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase">
                      Source
                    </th>
                    <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase">
                      Date
                    </th>
                    <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(project.deployments || []).map((deploy: any) => (
                    <tr
                      key={deploy.id}
                      className="hover:bg-white/5 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-muted-foreground">
                          #{deploy.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-medium border uppercase",
                            getStatusColor(deploy.status),
                          )}
                        >
                          {deploy.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm text-foreground">main</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(deploy.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeploymentClick(deploy.id)}
                            className="h-8 text-violet hover:bg-violet/10"
                          >
                            Logs
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-muted-foreground hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!project.deployments || project.deployments.length === 0) && (
                <div className="py-20 flex flex-col items-center text-center">
                  <Rocket className="w-12 h-12 text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground">
                    No deployment history found
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="col-span-8 space-y-6">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">
                  Project Settings
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground px-1">
                      Project Name
                    </label>
                    <input
                      type="text"
                      defaultValue={project.name}
                      className="w-full bg-white/5 border border-white/10 rounded-xl h-11 px-4 text-foreground focus:outline-none focus:border-violet/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground px-1">
                      Description
                    </label>
                    <textarea
                      defaultValue={project.description || ""}
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-foreground focus:outline-none focus:border-violet/50 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
                <Button variant="ghost" className="hover:bg-white/10">
                  Discard
                </Button>
                <Button className="bg-violet hover:bg-violet-600 text-white shadow-glow">
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <DeployTemplateModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        project={project}
        serverId={project.serverId}
      />
    </div>
  );
}
