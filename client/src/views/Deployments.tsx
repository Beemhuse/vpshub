import { useState, useEffect, useRef } from "react";
import {
  Rocket,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDeployments } from "../hooks/useApi";

interface DeploymentsProps {
  serverId: string;
}

export function Deployments({ serverId }: DeploymentsProps) {
  const [selectedDeployment, setSelectedDeployment] = useState<any>(null);
  const { data: deployments, isLoading } = useDeployments(serverId);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedDeployment]);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return <Clock className="w-4 h-4 text-warning" />;
      case "in_progress":
        return (
          <div className="w-4 h-4 rounded-full border-2 border-violet border-t-transparent animate-spin" />
        );
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "in_progress":
        return "text-violet bg-violet/20 border-violet/30";
      case "completed":
        return "text-success bg-success/20 border-success/30";
      case "failed":
        return "text-destructive bg-destructive/20 border-destructive/30";
      default:
        return "text-warning bg-warning/20 border-warning/30";
    }
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <RefreshCcw className="w-8 h-8 text-violet animate-spin" />
        <p className="text-muted-foreground">Loading deployments...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Deployments</h2>
          <p className="text-muted-foreground mt-1">
            Track and manage your application deployments
          </p>
        </div>
        <Button className="h-10 px-4 bg-violet hover:bg-violet-600 text-white transition-all hover:shadow-glow">
          <Rocket className="w-4 h-4 mr-2" />
          New Deployment
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Deployments List */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h3 className="font-semibold text-foreground">
              Recent Deployments
            </h3>
          </div>

          <div className="divide-y divide-white/10 max-h-[600px] overflow-y-auto custom-scrollbar">
            {deployments?.map((deployment: any) => (
              <div
                key={deployment.id}
                onClick={() => setSelectedDeployment(deployment)}
                className={cn(
                  "px-5 py-4 cursor-pointer transition-colors",
                  selectedDeployment?.id === deployment.id
                    ? "bg-white/[0.08]"
                    : "hover:bg-white/5",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(deployment.status)}
                    <div>
                      <h4 className="font-medium text-foreground">
                        {deployment.server?.name || "New Deployment"}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1 uppercase">
                          {deployment.server?.os || "System"}
                        </span>
                        <span>ID: {deployment.id.split("-")[0]}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize",
                      getStatusColor(deployment.status),
                    )}
                  >
                    {deployment.status.replace("_", " ")}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(deployment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {(!deployments || deployments.length === 0) && (
              <div className="p-10 text-center text-muted-foreground">
                No historical deployments
              </div>
            )}
          </div>
        </div>

        {/* Details View */}
        <div>
          {selectedDeployment ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">
                      Deployment Details
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      #{selectedDeployment.id}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "px-3 py-1 rounded-full text-xs border capitalize font-medium",
                      getStatusColor(selectedDeployment.status),
                    )}
                  >
                    {selectedDeployment.status.replace("_", " ")}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">
                      Server
                    </div>
                    <div className="text-sm font-medium">
                      {selectedDeployment.server?.name}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-xs text-muted-foreground mb-1">
                      Created At
                    </div>
                    <div className="text-sm font-medium">
                      {new Date(selectedDeployment.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-dark p-4 font-mono text-xs overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      Lifecycle Events
                    </span>
                  </div>
                  <div className="space-y-1 text-muted-foreground/80">
                    <p>
                      {new Date(selectedDeployment.createdAt).toISOString()}{" "}
                      [INFO] Deployment initialized
                    </p>
                    <p>
                      {new Date(selectedDeployment.createdAt).toISOString()}{" "}
                      [INFO] Allocating resources...
                    </p>
                    <p>
                      {new Date(selectedDeployment.createdAt).toISOString()}{" "}
                      [INFO] System check passed
                    </p>
                    {selectedDeployment.status === "COMPLETED" && (
                      <p className="text-success">
                        [SUCCESS] Infrastructure ready
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
              <Rocket className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                Select a deployment to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
