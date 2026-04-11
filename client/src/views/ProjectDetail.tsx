import {
  ArrowLeft,
  Settings,
  Rocket,
  Trash2,
  History,
  GitBranch,
  Globe,
  ChevronRight,
  AlertCircle,
  Loader2,
  Plus,
  X,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useDeploymentMutations,
  useDeploymentDockerServices,
  useProject,
  useProjectMutations,
} from "../hooks/useApi";
import { DeployModal } from "../components/DeployModal";
import api from "../services/api";
import { toast } from "sonner";
import { useEffect, useState } from "react";

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
  const { deleteProject, isDeleting, updateProject, isUpdating } =
    useProjectMutations();
  const { restartService: restartServiceMutation, isRestarting: isRestartingMutation } = useDeploymentMutations();
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    domain: "",
    repositoryUrl: "",
    rootDir: "",
    exposedPort: "",
  });
  const [envVars, setEnvVars] = useState([{ key: "", value: "" }]);
  const [serviceDomains, setServiceDomains] = useState<Record<string, string>>(
    {},
  );
  const latestDeployment = project?.deployments?.[0];
  const isDockerProject = project?.type?.toLowerCase() === "docker";
  const { data: dockerServices } = useDeploymentDockerServices(
    isDockerProject ? latestDeployment?.id || "" : "",
  );

  useEffect(() => {
    if (!project) return;
    setForm({
      name: project.name || "",
      description: project.description || "",
      domain: project.domain || latestDeployment?.domain || "",
      repositoryUrl: project.repositoryUrl || "",
      rootDir: project.rootDir || "",
      exposedPort: project.exposedPort ? String(project.exposedPort) : "",
    });
    const envObject =
      project.env && typeof project.env === "object" ? project.env : {};
    const nextEnvVars = Object.entries(envObject as Record<string, string>).map(
      ([key, value]) => ({
        key,
        value: String(value ?? ""),
      }),
    );
    const nextServiceDomains =
      project.serviceDomains && typeof project.serviceDomains === "object"
        ? Object.fromEntries(
            Object.entries(project.serviceDomains as Record<string, unknown>).map(
              ([service, domain]) => [service, String(domain ?? "")],
            ),
          )
        : {};
    setEnvVars(nextEnvVars.length ? nextEnvVars : [{ key: "", value: "" }]);
    setServiceDomains(nextServiceDomains);
  }, [project]);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-violet animate-spin" />
        <p className="text-muted-foreground">Loading project details...</p>
      </div>
    );
  }

  if (!project) return null;

  const dockerServiceNames = Array.from(
    new Set([
      ...Object.keys(serviceDomains),
      ...((dockerServices || []).map((service: any) => service.service) as string[]),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const getServiceFallbackDomain = (serviceName: string) => {
    const baseDomain = form.domain.trim() || project.domain || latestDeployment?.domain;
    return baseDomain ? `${serviceName}.${baseDomain}` : `${serviceName}.example.com`;
  };

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

  const handleSave = async () => {
    const formattedEnv = envVars.reduce((acc: Record<string, string>, item) => {
      if (item.key.trim()) {
        acc[item.key.trim()] = item.value;
      }
      return acc;
    }, {});
    const formattedServiceDomains = Object.entries(serviceDomains).reduce(
      (acc: Record<string, string>, [service, domain]) => {
        if (service.trim() && domain.trim()) {
          acc[service.trim()] = domain.trim();
        }
        return acc;
      },
      {},
    );

    try {
      await updateProject({
        id: projectId,
        data: {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          repositoryUrl: form.repositoryUrl.trim() || undefined,
          ...(isDockerProject
            ? {
                domain:
                  form.domain.trim() ||
                  project.domain ||
                  latestDeployment?.domain ||
                  undefined,
                rootDir: form.rootDir.trim() || undefined,
                exposedPort: form.exposedPort
                  ? Number(form.exposedPort)
                  : undefined,
                env: formattedEnv,
                serviceDomains: formattedServiceDomains,
              }
            : {}),
        },
      });
      toast.success(
        isDockerProject
          ? "Project settings saved and running Docker deployment updated"
          : "Project settings saved",
      );
    } catch (error) {
      toast.error(
        isDockerProject
          ? "Failed to save project settings or apply Docker config"
          : "Failed to save project settings",
      );
    }
  };

  const addEnvVar = () => {
    setEnvVars((prev) => [...prev, { key: "", value: "" }]);
  };

  const updateEnvVar = (
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    setEnvVars((prev) =>
      prev.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ),
    );
  };

  const removeEnvVar = (index: number) => {
    setEnvVars((prev) =>
      prev.length === 1
        ? [{ key: "", value: "" }]
        : prev.filter((_, entryIndex) => entryIndex !== index),
    );
  };

  const updateServiceDomain = (serviceName: string, value: string) => {
    setServiceDomains((prev) => ({
      ...prev,
      [serviceName]: value,
    }));
  };
  
  const handleRestartService = async (serviceName: string) => {
    if (!latestDeployment) return;
    try {
      if (typeof restartServiceMutation === 'function') {
        await restartServiceMutation({
          deploymentId: latestDeployment.id,
          serviceName,
        });
      } else {
        await api.post(
          `/deployments/${latestDeployment.id}/docker-services/${encodeURIComponent(
            serviceName,
          )}/restart`,
        );
      }
      toast.success(`Service ${serviceName} is restarting...`);
    } catch (error) {
      toast.error(`Failed to restart service ${serviceName}`);
    }
  };

  const isRestarting = isRestartingMutation || false;

  const suggestSubdomains = () => {
    const baseDomain = form.domain.trim();
    if (!baseDomain) {
      toast.error("Please set a base domain first");
      return;
    }

    const nextServiceDomains = { ...serviceDomains };
    dockerServiceNames.forEach((name) => {
      if (!nextServiceDomains[name]) {
        nextServiceDomains[name] = `${name}.${baseDomain}`;
      }
    });
    setServiceDomains(nextServiceDomains);
    toast.success("Subdomains suggested based on base domain");
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
                    <span className="text-sm font-medium">
                      {isDockerProject ? "Routing" : "Domain"}
                    </span>
                  </div>
                  <p className="text-sm text-foreground truncate">
                    {isDockerProject
                      ? dockerServiceNames.length
                        ? `${dockerServiceNames.length} service route${
                            dockerServiceNames.length === 1 ? "" : "s"
                          } configured`
                        : form.domain || project.domain || latestDeployment?.domain || "Fallback only"
                      : project.domain || latestDeployment?.domain || "Not configured"}
                  </p>
                </div>
              </div>

              {isDockerProject && (
                <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Docker Services
                    </h3>
                    <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-white/10">
                      {(dockerServices || []).length} Containers
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {(dockerServices || []).length > 0 ? (
                      (dockerServices || []).map((service: any) => (
                        <div 
                          key={service.service}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-violet/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              service.status.startsWith('Up') 
                                ? "bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]" 
                                : "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                            )} />
                          <div>
                              <p className="text-sm font-medium text-foreground">
                                {service.service}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {service.status}
                              </p>
                              {service.ports && (
                                <p className="text-[10px] text-violet/80 font-mono mt-0.5">
                                  🔌 {service.ports}
                                </p>
                              )}
                              {service.domain && (
                                <p className="text-[10px] text-success/70 font-mono mt-0.5 truncate max-w-[180px]">
                                  🌐 {service.domain}
                                </p>
                              )}
                              {service.connectionUrl && (
                                <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
                                  <p className="text-[10px] font-mono text-amber-400/80 truncate max-w-[200px]">
                                    🗄 {service.connectionUrl}
                                  </p>
                                  <button
                                    type="button"
                                    title="Copy connection URL"
                                    onClick={() => {
                                      navigator.clipboard.writeText(service.connectionUrl);
                                      toast.success("Connection URL copied!");
                                    }}
                                    className="shrink-0 text-[9px] text-muted-foreground hover:text-foreground border border-white/10 rounded px-1 py-0.5 bg-white/5 hover:bg-white/10 transition-colors"
                                  >
                                    copy
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                             <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => {
                                onDeploymentClick(latestDeployment?.id || "");
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-violet hover:bg-violet/10"
                              title="View logs"
                            >
                              <Terminal className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => handleRestartService(service.service)}
                              disabled={isRestarting}
                              className="h-8 w-8 text-muted-foreground hover:text-warning hover:bg-warning/10"
                              title="Restart service"
                            >
                              <RefreshCw className={cn("w-3.5 h-3.5", isRestarting && "animate-spin")} />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center">
                        <p className="text-xs text-muted-foreground">No services detected yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-4 space-y-6">
              {/* Port Map */}
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
                <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
                  {isDockerProject ? "Service Port Map" : "Deployment Info"}
                </h3>
                <div className="space-y-3">
                  {isDockerProject ? (
                    (dockerServices || []).length > 0 ? (
                      (dockerServices || []).map((service: any) => (
                        <div key={service.service} className="rounded-xl bg-white/5 border border-white/5 p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">{service.service}</span>
                            <span className={cn(
                              "text-[9px] font-medium px-1.5 py-0.5 rounded-full border",
                              service.isRunning
                                ? "text-success bg-success/10 border-success/20"
                                : "text-destructive bg-destructive/10 border-destructive/20"
                            )}>
                              {service.isRunning ? "UP" : "DOWN"}
                            </span>
                          </div>
                          {service.ports && (
                            <p className="text-[10px] font-mono text-violet/80 truncate">{service.ports}</p>
                          )}
                          {service.domain && (
                            <p className="text-[10px] font-mono text-muted-foreground truncate">{service.domain}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Deploy to discover services & ports.</p>
                    )
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Domain</span>
                        <span className="text-sm text-foreground font-mono truncate max-w-[150px]">
                          {project.domain || latestDeployment?.domain || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Deployments</span>
                        <span className="text-sm text-foreground font-medium">{project.deployments?.length ?? 0}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Env warning */}
              {isDockerProject && (
                <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
                  <p className="text-[10px] text-warning font-medium mb-1">⚠ Env Variables</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    If your app uses encryption keys or secrets, make sure to add them under Settings → Environment Variables. Missing vars like <code className="bg-white/10 px-1 rounded">ENCRYPTION_KEY</code> will crash the container on startup.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "deployments" && (
          <div className="col-span-12">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase">ID</th>
                    <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase">Source</th>
                    <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(project.deployments || []).map((deploy: any) => (
                    <tr key={deploy.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-muted-foreground">#{deploy.id.slice(0, 8)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium border uppercase", getStatusColor(deploy.status))}>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!project.deployments || project.deployments.length === 0) && (
                <div className="py-20 flex flex-col items-center text-center">
                  <Rocket className="w-12 h-12 text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground">No deployment history found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="col-span-8 space-y-6">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Project Settings</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground px-1">Project Name</label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="bg-white/5 border-white/10 text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground px-1">Description</label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="bg-white/5 border-white/10 text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground px-1">Repository URL</label>
                    <Input
                      value={form.repositoryUrl}
                      onChange={(e) => setForm((prev) => ({ ...prev, repositoryUrl: e.target.value }))}
                      className="bg-white/5 border-white/10 text-foreground"
                    />
                  </div>

                  {isDockerProject && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground px-1">Base Domain</label>
                        <Input
                          value={form.domain}
                          onChange={(e) => setForm((prev) => ({ ...prev, domain: e.target.value }))}
                          className="bg-white/5 border-white/10 text-foreground"
                        />
                      </div>

                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-foreground">Service Domains</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={suggestSubdomains}
                            className="h-7 text-[10px] text-violet hover:bg-violet/10"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Suggest Subdomains
                          </Button>
                        </div>
                        {dockerServiceNames.length ? (
                          <div className="space-y-3">
                            {dockerServiceNames.map((serviceName) => (
                              <div key={serviceName} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                <p className="text-sm font-medium text-foreground">{serviceName}</p>
                                <Input
                                  value={serviceDomains[serviceName] || ""}
                                  onChange={(e) => updateServiceDomain(serviceName, e.target.value)}
                                  placeholder={getServiceFallbackDomain(serviceName)}
                                  className="mt-2 bg-white/5 border-white/10 text-foreground"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-muted-foreground">
                            Deploy once to discover services.
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground px-1">Root Directory</label>
                          <Input
                            value={form.rootDir}
                            onChange={(e) => setForm((prev) => ({ ...prev, rootDir: e.target.value }))}
                            className="bg-white/5 border-white/10 text-foreground"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground px-1">Exposed Port</label>
                          <Input
                            type="number"
                            value={form.exposedPort}
                            onChange={(e) => setForm((prev) => ({ ...prev, exposedPort: e.target.value }))}
                            className="bg-white/5 border-white/10 text-foreground"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-foreground">Environment Variables</h4>
                          <Button type="button" variant="outline" size="sm" onClick={addEnvVar} className="border-white/10 bg-white/5">
                            <Plus className="w-4 h-4 mr-2" /> Add Variable
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {envVars.map((envVar, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                value={envVar.key}
                                onChange={(e) => updateEnvVar(index, "key", e.target.value)}
                                placeholder="KEY"
                                className="bg-white/5 border-white/10 text-foreground"
                              />
                              <Input
                                value={envVar.value}
                                onChange={(e) => updateEnvVar(index, "value", e.target.value)}
                                placeholder="VALUE"
                                className="bg-white/5 border-white/10 text-foreground"
                              />
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeEnvVar(index)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => window.location.reload()}>Discard</Button>
                <Button onClick={handleSave} disabled={isUpdating} className="bg-violet hover:bg-violet-600 text-white shadow-glow">
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <DeployModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        project={project}
        serverId={project.serverId}
      />
    </div>
  );
}
