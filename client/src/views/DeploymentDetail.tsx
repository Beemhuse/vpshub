import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Terminal,
  ShieldCheck,
  Clock,
  ExternalLink,
  Server,
  Cloud,
  CheckCircle2,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useDeployment,
  useDeploymentDockerLogs,
  useDeploymentDockerServices,
  useDeploymentMutations,
} from "../hooks/useApi";
import { toast } from "sonner";

interface DeploymentDetailProps {
  deploymentId: string;
  onBack: () => void;
}

export function DeploymentDetail({
  deploymentId,
  onBack,
}: DeploymentDetailProps) {
  const { data: deployment, isLoading } = useDeployment(deploymentId);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const { deleteDeployment, isDeleting } = useDeploymentMutations();
  const isDockerDeployment = deployment?.project?.type === "docker";
  const { data: dockerServices, isLoading: isLoadingDockerServices } =
    useDeploymentDockerServices(isDockerDeployment ? deploymentId : "");
  const { data: dockerLogs, isLoading: isLoadingDockerLogs } =
    useDeploymentDockerLogs(
      isDockerDeployment ? deploymentId : "",
      selectedService || undefined,
      250,
    );
  const logEndRef = useRef<HTMLDivElement>(null);
  const dockerLogEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [deployment?.logs]);

  useEffect(() => {
    if (!selectedService && dockerServices?.length) {
      setSelectedService(dockerServices[0].service);
    }
  }, [dockerServices, selectedService]);

  useEffect(() => {
    if (dockerLogEndRef.current) {
      dockerLogEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [dockerLogs?.logs]);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-violet animate-spin" />
        <p className="text-muted-foreground">
          Gathering deployment lifecycle...
        </p>
      </div>
    );
  }

  if (!deployment) return null;

  const handleDelete = async () => {
    if (
      confirm(
        "Are you sure you want to delete this deployment? This will stop the application and remove all associated files and configurations from the server.",
      )
    ) {
      try {
        await deleteDeployment(deploymentId);
        toast.success("Deployment deleted and server cleaned up");
        onBack();
      } catch (error) {
        toast.error("Failed to delete deployment");
      }
    }
  };

  const statusColors: Record<string, string> = {
    completed: "text-success bg-success/20 border-success/30",
    failed: "text-destructive bg-destructive/20 border-destructive/30",
    "in-progress": "text-violet bg-violet/20 border-violet/30 animate-pulse",
    pending: "text-warning bg-warning/20 border-warning/30",
  };

  const statusStyle =
    statusColors[deployment.status] || "text-muted-foreground bg-white/10";

  return (
    <div className="space-y-6 animate-fade-in pb-20">
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
                Deployment{" "}
                <span className="text-muted-foreground font-mono">
                  #{deployment.id.slice(0, 8)}
                </span>
              </h2>
              <span
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-medium border uppercase",
                  statusStyle,
                )}
              >
                {deployment.status}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Started {new Date(deployment.createdAt).toLocaleString()}
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
            {isDeleting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Cleanup & Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Info Cards */}
        <div className="col-span-12 grid grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-3 mb-2 text-muted-foreground">
              <Server className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">
                Target Server
              </span>
            </div>
            <p className="font-medium text-foreground">
              {deployment.server?.name || "Unknown Server"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {deployment.server?.ip}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-3 mb-2 text-muted-foreground">
              <Cloud className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">
                Artifact
              </span>
            </div>
            <p className="font-medium text-foreground truncate">main</p>
            <p className="text-xs text-muted-foreground mt-1">Branch/Tag</p>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-3 mb-2 text-muted-foreground">
              <ExternalLink className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">
                Public Access
              </span>
            </div>
            <p className="font-medium text-foreground truncate">
              {isDockerDeployment ? (
                dockerServices?.length ? (
                  `${dockerServices.length} service route${dockerServices.length === 1 ? "" : "s"}`
                ) : (
                  "Per-service routing"
                )
              ) : deployment.domain ? (
                <a
                  href={`http://${deployment.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-violet transition-colors flex items-center gap-1 group"
                >
                  {deployment.domain}{" "}
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ) : (
                "Not configured"
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isDockerDeployment ? "Managed per Docker service" : "HTTP / HTTPS"}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-3 mb-2 text-muted-foreground">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">
                SSL Security
              </span>
            </div>
            <p className="font-medium text-foreground">
              {deployment.domain ? "Automated" : "N/A"}
            </p>
            <p className="text-xs text-success flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3" />
              Certbot Ready
            </p>
          </div>
        </div>

        {isDockerDeployment && (
          <div className="col-span-12 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-violet" />
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Docker Services
                </h3>
              </div>
              {isLoadingDockerServices && (
                <span className="text-[10px] uppercase tracking-wider text-violet">
                  Refreshing
                </span>
              )}
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4 space-y-3">
                {(dockerServices || []).map((service: any) => (
                  <button
                    key={service.name}
                    onClick={() => setSelectedService(service.service)}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition-all",
                      selectedService === service.service
                        ? "border-violet/40 bg-violet/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {service.service}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
                          {service.name}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase",
                          service.isRunning
                            ? "text-success bg-success/20 border-success/30"
                            : "text-destructive bg-destructive/20 border-destructive/30",
                        )}
                      >
                        {service.isRunning ? "up" : "down"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      {service.image}
                    </p>
                    {service.ports && service.ports !== 'N/A' && (
                      <p className="text-[10px] font-mono text-violet/80 mt-1 bg-violet/5 px-1.5 py-0.5 rounded border border-violet/10 inline-block">
                        {service.ports}
                      </p>
                    )}
                    {service.domain ? (
                      <p className="mt-2 inline-flex items-center gap-1 text-xs text-violet break-all">
                        {service.domain}
                        <ExternalLink className="w-3 h-3" />
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-1">
                      {service.status}
                    </p>
                  </button>
                ))}

                {!isLoadingDockerServices && (!dockerServices || dockerServices.length === 0) && (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-muted-foreground">
                    No Docker services found for this deployment.
                  </div>
                )}
              </div>

              <div className="col-span-8 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">
                      {selectedService ? `${selectedService} Logs` : "Service Logs"}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Live tail of the selected deployed Docker service
                    </p>
                  </div>
                </div>

                <div className="aspect-[21/9] rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl p-6 font-mono text-sm overflow-auto custom-scrollbar">
                  {isLoadingDockerLogs ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Loading container logs...
                    </div>
                  ) : dockerLogs?.logs ? (
                    <div className="space-y-1">
                      {dockerLogs.logs.split("\n").map((log: string, i: number) => (
                        <div
                          key={i}
                          className={cn(
                            "flex gap-4",
                            /error|failed|exception/i.test(log)
                              ? "text-destructive"
                              : /listening|ready|started|up/i.test(log)
                                ? "text-success"
                                : "text-muted-foreground",
                          )}
                        >
                          <span className="text-white/20 select-none w-8 text-right shrink-0">
                            {i + 1}
                          </span>
                          <span className="break-all">{log}</span>
                        </div>
                      ))}
                      <div ref={dockerLogEndRef} />
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Select a service to inspect its logs.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Console Logs */}
        <div className="col-span-12 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-violet" />
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Deployment Logs
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {deployment.status === "in-progress" && (
                <span className="flex items-center gap-2 text-[10px] text-violet font-medium uppercase tracking-tighter">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet"></span>
                  </span>
                  Live Monitoring
                </span>
              )}
            </div>
          </div>

          <div className="aspect-[21/9] rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl p-6 font-mono text-sm overflow-auto custom-scrollbar">
            <div className="space-y-1">
              {deployment.logs?.split("\n").map((log: string, i: number) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-4",
                    log.startsWith("Error") || log.includes("failed")
                      ? "text-destructive"
                      : log.startsWith("Success") || log.includes("successful")
                        ? "text-success"
                        : log.startsWith("[")
                          ? "text-violet font-bold"
                          : "text-muted-foreground",
                  )}
                >
                  <span className="text-white/20 select-none w-8 text-right shrink-0">
                    {i + 1}
                  </span>
                  <span className="break-all">{log}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
