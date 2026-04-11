import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Box,
  Rocket,
  GitBranch,
  X,
  ShieldCheck,
  Settings,
  Loader2,
} from "lucide-react";
import { useDeploymentMutations, useTemplates, useDeploymentDockerServices, useDeployment, useProjectMutations } from "../hooks/useApi";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { io, Socket } from "socket.io-client";
import { useRef } from "react";
import { useAuthStore } from "../store/authStore";
import { Terminal, CheckCircle2, AlertCircle as AlertIcon } from "lucide-react";

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  project?: any;
  template?: any;
  serverId?: string;
}

export function DeployModal({
  isOpen,
  onClose,
  onSuccess,
  project,
  template: initialTemplate,
  serverId: propServerId,
}: DeployModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(project || initialTemplate ? 2 : 1);
  const [domain, setDomain] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState(project?.repositoryUrl || "");
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplate?.id || "");
  const [startCmd, setStartCmd] = useState("");
  const [buildCmd, setBuildCmd] = useState("");
  const [installCmd, setInstallCmd] = useState("");
  const [rootDir, setRootDir] = useState("");
  const [exposedPort, setExposedPort] = useState("");
  const [envVars, setEnvVars] = useState([{ key: "", value: "" }]);

  // Log streaming state
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [deploymentStatus, setDeploymentStatus] = useState<"pending" | "in-progress" | "completed" | "failed">("pending");
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuthStore(); // Keep if needed for future, but removing unused warning by just acknowledging it
  console.debug("Current user:", user?.id);

  const { data: templates } = useTemplates();
  const { createDeployment, isCreating } = useDeploymentMutations();

  const selectedTemplate = (templates || []).find((t: any) => t.id === selectedTemplateId) || initialTemplate;
  const isDockerTemplate = selectedTemplate?.type === "DOCKER";
  const isNodeTemplate = selectedTemplate?.type === "NODE";
  const isStaticTemplate = selectedTemplate?.type === "STATIC";

  const { data: deployment } = useDeployment(deploymentStatus === "completed" ? deploymentId || "" : "");
  const { data: dockerServices } = useDeploymentDockerServices(deploymentStatus === "completed" && isDockerTemplate ? deploymentId || "" : "");
  const { updateProject } = useProjectMutations();
  
  const [serviceDomains, setServiceDomains] = useState<Record<string, string>>({});
  const [isApplyingDomains, setIsApplyingDomains] = useState(false);

  useEffect(() => {
    if (deployment?.project?.serviceDomains && typeof deployment.project.serviceDomains === "object") {
      setServiceDomains(deployment.project.serviceDomains as Record<string, string>);
    }
  }, [deployment?.project?.serviceDomains]);

  const dockerServiceNames = Array.from(
    new Set([
      ...Object.keys(serviceDomains),
      ...((dockerServices || []).map((service: any) => service.service) as string[]),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const handleApplyDomains = async () => {
    if (!deployment?.projectId) return;
    setIsApplyingDomains(true);
    try {
      const formattedServiceDomains = Object.entries(serviceDomains).reduce(
        (acc: Record<string, string>, [service, domain]) => {
          if (service.trim() && domain.trim()) {
            acc[service.trim()] = domain.trim();
          }
          return acc;
        },
        {}
      );
      await updateProject({
        id: deployment.projectId,
        data: {
          serviceDomains: formattedServiceDomains
        }
      });
      toast.success("Domains mapped and Docker redeployed with new routing.");
    } catch (e) {
      toast.error("Failed to map domains");
    } finally {
      setIsApplyingDomains(false);
    }
  };

  const serverId = propServerId || (() => {
    try {
      const saved = localStorage.getItem("vpshub_selectedServer");
      return saved ? JSON.parse(saved).id : null;
    } catch {
      return null;
    }
  })();



  useEffect(() => {
    if (initialTemplate) {
      setSelectedTemplateId(initialTemplate.id);
      setStep(2);
    }
  }, [initialTemplate]);

  useEffect(() => {
    if (project) {
      setRepositoryUrl(project.repositoryUrl || "");
      setStep(2);
    }
  }, [project]);

  useEffect(() => {
    if (selectedTemplate) {
      setStartCmd(prev => prev || selectedTemplate.startCmd || "");
      setBuildCmd(prev => prev || selectedTemplate.buildCmd || "");
      setInstallCmd(prev => prev || selectedTemplate.installCmd || "");
      setRootDir(prev => prev || selectedTemplate.rootDir || "");
      if (selectedTemplate.defaultPort && !exposedPort) {
        setExposedPort(String(selectedTemplate.defaultPort));
      }
    }
  }, [selectedTemplate?.id]);

  // Socket Connection for Logs
  useEffect(() => {
    if (step === 3 && deploymentId) {
      const token = document.cookie
        .split("; ")
        .find(row => row.startsWith("access_token="))
        ?.split("=")[1];

      const socket = io(`${import.meta.env.VITE_API_URL || "http://localhost:3800"}/deployments`, {
        auth: { token },
        transports: ["websocket"],
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("deployment:subscribe", { deploymentId });
      });

      socket.on("deployment:log", (data) => {
        if (data.deploymentId === deploymentId) {
          setLogs(prev => [...prev, data.message]);
          if (data.message.includes("Deployment status: COMPLETED") || data.message.includes("✅ DOCKER DEPLOYMENT COMPLETED")) {
            setDeploymentStatus("completed");
          }
          if (data.message.includes("!!! DEPLOYMENT ERROR") || data.message.includes("❌ DEPLOYMENT FAILED")) {
            setDeploymentStatus("failed");
          }
        }
      });

      socket.on("deployment:error", (err) => {
        toast.error(err.message || "Log subscription failed");
      });

      return () => {
        socket.emit("deployment:unsubscribe", { deploymentId });
        socket.disconnect();
      };
    }
  }, [step, deploymentId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleDeploy = async () => {
    if (!serverId) {
      toast.error("No server selected. Please select a server first.");
      return;
    }

    const templateId = selectedTemplateId || initialTemplate?.id;
    if (!templateId && !project) {
      toast.error("Please select a template");
      return;
    }

    const formattedEnv = envVars.reduce((acc: any, { key, value }) => {
      if (key.trim()) acc[key.trim()] = value;
      return acc;
    }, {});

    const gitUrlPattern = /^(https?:\/\/|git@|ssh:\/\/).*\.git$/i;
    if ((isDockerTemplate || isNodeTemplate || isStaticTemplate) && repositoryUrl && !gitUrlPattern.test(repositoryUrl)) {
      toast.error("Please enter a valid Git URL (ending in .git)");
      return;
    }

    try {
      const response = await createDeployment({
        serverId,
        projectId: project?.id,
        templateId: templateId,
        name: project?.name || selectedTemplate?.name || "New Deployment",
        domain: domain || undefined,
        repositoryUrl: repositoryUrl || project?.repositoryUrl || undefined,
        dockerImage: !repositoryUrl ? project?.dockerImage : undefined,
        startCmd: isNodeTemplate ? startCmd || undefined : undefined,
        buildCmd: isNodeTemplate || isDockerTemplate ? buildCmd || undefined : undefined,
        installCmd: isNodeTemplate || isStaticTemplate ? installCmd || undefined : undefined,
        rootDir: isNodeTemplate || isDockerTemplate || isStaticTemplate ? rootDir || undefined : undefined,
        exposedPort: exposedPort ? Number(exposedPort) : undefined,
        env: Object.keys(formattedEnv).length > 0 ? formattedEnv : undefined,
      });

      setDeploymentId(response.id);
      setStep(3);
      setLogs(["Initializing deployment..."]);
      setDeploymentStatus("in-progress");
      toast.success("Deployment initiated successfully");
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error("Failed to start deployment");
    }
  };

  const resetAndClose = () => {
    onClose();
    setTimeout(() => {
      setStep(project || initialTemplate ? 2 : 1);
      setDomain("");
      setEnvVars([{ key: "", value: "" }]);
      setServiceDomains({});
      setLogs([]);
      setDeploymentId(null);
      setDeploymentStatus("pending");
    }, 300);
  };

  const categories = ["All", "Docker", "Node.js", "Static"];
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredTemplates = (templates || []).filter((t: any) => {
    if (activeCategory === "All") return true;
    if (activeCategory === "Docker") return t.type === "DOCKER";
    if (activeCategory === "Node.js") return t.type === "NODE";
    if (activeCategory === "Static") return t.type === "STATIC";
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-[700px] bg-dark-100 border-white/10 text-white p-0 overflow-hidden shadow-glow">
        <DialogHeader className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {step === 1 && <><Rocket className="w-5 h-5 text-violet" /> Select Template</>}
              {step === 2 && <><Settings className="w-5 h-5 text-violet" /> Configure {selectedTemplate?.name || project?.name}</>}
              {step === 3 && <><Terminal className="w-5 h-5 text-violet" /> Deployment Progress</>}
            </DialogTitle>
            {step === 3 && (
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                deploymentStatus === "in-progress" && "bg-violet/20 text-violet animate-pulse",
                deploymentStatus === "completed" && "bg-green-500/20 text-green-400",
                deploymentStatus === "failed" && "bg-red-500/20 text-red-400",
              )}>
                {deploymentStatus}
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                      activeCategory === cat
                        ? "bg-violet text-white shadow-lg"
                        : "text-muted-foreground hover:text-white"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {filteredTemplates.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTemplateId(t.id);
                      setStep(2);
                    }}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-violet/50 hover:bg-white/10 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-violet/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      {t.type === "DOCKER" ? <Box className="w-5 h-5 text-violet" /> : <ShieldCheck className="w-5 h-5 text-violet" />}
                    </div>
                    <h4 className="font-semibold text-sm mb-1">{t.name}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <button
                onClick={() => !project && !initialTemplate && setStep(1)}
                className={cn(
                  "text-xs text-violet hover:text-violet-400 flex items-center gap-1 mb-2",
                  (project || initialTemplate) && "hidden"
                )}
              >
                ← Back to templates
              </button>

              <div className="space-y-4">
                {(isDockerTemplate || isNodeTemplate || isStaticTemplate) && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-violet" />
                      Repository URL <span className="text-red-400">*</span>
                    </label>
                    <Input
                      placeholder="https://github.com/user/repo.git"
                      value={repositoryUrl}
                      onChange={(e) => setRepositoryUrl(e.target.value)}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-violet" />
                    Custom Domain (Optional)
                  </label>
                  <Input
                    placeholder="app.example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>

                {isDockerTemplate && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Exposed Port</label>
                      <Input
                        type="number"
                        placeholder="80"
                        value={exposedPort}
                        onChange={(e) => setExposedPort(e.target.value)}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Root Directory</label>
                      <Input
                        placeholder="."
                        value={rootDir}
                        onChange={(e) => setRootDir(e.target.value)}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>
                )}

                {(isNodeTemplate || isStaticTemplate) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Build Command</label>
                      <Input
                        placeholder="npm run build"
                        value={buildCmd}
                        onChange={(e) => setBuildCmd(e.target.value)}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    {isNodeTemplate && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Start Command</label>
                        <Input
                          placeholder="npm start"
                          value={startCmd}
                          onChange={(e) => setStartCmd(e.target.value)}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Environment Variables</label>
                    <button onClick={() => setEnvVars([...envVars, { key: "", value: "" }])} className="text-xs text-violet hover:text-violet-400">+ Add</button>
                  </div>
                  <div className="space-y-2">
                    {envVars.map((ev, i) => (
                      <div key={i} className="flex gap-2">
                        <Input placeholder="KEY" value={ev.key} onChange={(e) => {
                          const n = [...envVars]; n[i].key = e.target.value; setEnvVars(n);
                        }} className="bg-white/5 border-white/10 text-xs" />
                        <Input placeholder="VALUE" value={ev.value} onChange={(e) => {
                          const n = [...envVars]; n[i].value = e.target.value; setEnvVars(n);
                        }} className="bg-white/5 border-white/10 text-xs" />
                        {envVars.length > 1 && (
                          <button onClick={() => setEnvVars(envVars.filter((_, idx) => idx !== i))} className="p-2 hover:text-red-400"><X className="w-3 h-3" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div 
                ref={scrollRef}
                className="bg-black/40 rounded-xl border border-white/5 p-4 h-[350px] overflow-y-auto font-mono text-[11px] leading-relaxed relative group"
              >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] text-muted-foreground">
                      <Terminal className="w-3 h-3" /> LIVE LOGS
                   </div>
                </div>
                
                {logs.map((log, i) => {
                  const isError = log.includes("ERROR") || log.includes("FAILED") || log.includes("invalid") || log.includes("failed");
                  const isSuccess = log.includes("SUCCESS") || log.includes("COMPLETED") || log.includes("Successful");
                  
                  return (
                    <div key={i} className={cn(
                      "mb-1 border-l-2 pl-3 py-0.5",
                      isError ? "border-red-500/50 text-red-300 bg-red-500/5" : 
                      isSuccess ? "border-green-500/50 text-green-300 bg-green-500/5" : 
                      "border-white/5 text-slate-300"
                    )}>
                      <span className="opacity-30 mr-2 tabular-nums">{(i + 1).toString().padStart(3, '0')}</span>
                      {log}
                    </div>
                  );
                })}
                {deploymentStatus === "in-progress" && (
                  <div className="flex items-center gap-2 mt-4 text-violet">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="animate-pulse">Building and deploying your app...</span>
                  </div>
                )}
              </div>

              {deploymentStatus === "completed" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-green-400 text-sm">Deployment Successful</h4>
                      <p className="text-xs text-green-300/70 mt-1">Your application has been deployed and is now accessible.</p>
                    </div>
                  </div>

                  {isDockerTemplate && dockerServiceNames.length > 0 && (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-white text-sm">Docker Services</h4>
                          <p className="text-xs text-muted-foreground mt-1">Configure custom domains for your individual services.</p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="bg-white/5 border-white/10"
                          onClick={() => {
                            const baseDomain = domain.trim() || deployment?.project?.domain;
                            if (!baseDomain) {
                              toast.error("No base domain available to suggest from.");
                              return;
                            }
                            const nextServiceDomains = { ...serviceDomains };
                            dockerServiceNames.forEach(name => {
                              if (!nextServiceDomains[name]) nextServiceDomains[name] = `${name}.${baseDomain}`;
                            });
                            setServiceDomains(nextServiceDomains);
                          }}
                        >
                          Suggest Subdomains
                        </Button>
                      </div>
                      
                      <div className="space-y-3">
                        {dockerServiceNames.map(serviceName => (
                          <div key={serviceName} className="flex gap-3">
                            <Input 
                              value={serviceName} 
                              disabled 
                              className="bg-white/5 border-white/10"
                            />
                            <Input 
                              placeholder={`${serviceName}.example.com`}
                              value={serviceDomains[serviceName] || ""}
                              onChange={(e) => setServiceDomains(prev => ({ ...prev, [serviceName]: e.target.value }))}
                              className="bg-white/5 border-white/10"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button 
                          onClick={handleApplyDomains} 
                          disabled={isApplyingDomains}
                          size="sm"
                          className="bg-violet hover:bg-violet-600 shadow-glow-sm"
                        >
                          {isApplyingDomains ? "Applying..." : "Save & Map Domains"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {deploymentStatus === "failed" && (
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                    <AlertIcon className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-400 text-sm">Deployment Failed</h4>
                    <p className="text-xs text-red-300/70 mt-1">Review the logs above to identify the issue. Common problems include invalid Git URLs, missing environment variables, or build errors.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-white/5 border-t border-white/10 flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={resetAndClose} className="text-muted-foreground hover:bg-white/5">
            {deploymentStatus === "completed" ? "Done" : "Cancel"}
          </Button>
          {step === 2 && (
            <Button onClick={handleDeploy} disabled={isCreating} className="bg-violet hover:bg-violet-600 text-white px-8 shadow-glow-sm">
              {isCreating ? "Preparing..." : "Confirm Deployment"}
            </Button>
          )}
          {step === 3 && deploymentStatus === "failed" && (
             <Button onClick={() => setStep(2)} className="bg-white/5 border border-white/10 hover:bg-white/10 text-white">
                Edit Settings & Retry
             </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
