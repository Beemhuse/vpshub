import { useState } from "react";
import {
  X,
  Terminal,
  Shield,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerConnect } from "../hooks/useApi";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ConnectVpsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectVpsModal({ isOpen, onClose }: ConnectVpsModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    ip: "",
    sshUser: "root",
    sshPassword: "",
    sshKey: "",
    sshPort: 22,
    os: "Ubuntu 22.04",
    region: "US East (N. Virginia)",
  });

  const { connectServer, isConnecting } = useServerConnect();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await connectServer(formData);
      toast.success("Connection initiated! Bootstrapping your VPS...");
      setStep(2);
    } catch (error) {
      toast.error("Failed to initiate connection");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-dark border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet/20 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-violet" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Connect Existing VPS
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Server Name
                  </label>
                  <Input
                    required
                    placeholder="e.g. Production Web"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="bg-white/5 border-white/10 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    IP Address
                  </label>
                  <Input
                    required
                    placeholder="1.2.3.4"
                    value={formData.ip}
                    onChange={(e) =>
                      setFormData({ ...formData, ip: e.target.value })
                    }
                    className="bg-white/5 border-white/10 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Region
                  </label>
                  <select
                    value={formData.region}
                    onChange={(e) =>
                      setFormData({ ...formData, region: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-violet/50"
                  >
                    <option className="bg-dark">US East (N. Virginia)</option>
                    <option className="bg-dark">US West (Oregon)</option>
                    <option className="bg-dark">EU (Frankfurt)</option>
                    <option className="bg-dark">
                      Asia Pacific (Singapore)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    SSH Port
                  </label>
                  <Input
                    type="number"
                    value={formData.sshPort}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sshPort: parseInt(e.target.value),
                      })
                    }
                    className="bg-white/5 border-white/10 text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 pb-1">
                  <Shield className="w-4 h-4 text-violet" />
                  <span className="text-sm font-semibold text-foreground">
                    Authentication
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      SSH User
                    </label>
                    <Input
                      required
                      value={formData.sshUser}
                      onChange={(e) =>
                        setFormData({ ...formData, sshUser: e.target.value })
                      }
                      className="bg-white/5 border-white/10 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                      SSH Password
                    </label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={formData.sshPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sshPassword: e.target.value,
                        })
                      }
                      className="bg-white/5 border-white/10 text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Or SSH Private Key
                  </label>
                  <textarea
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    value={formData.sshKey}
                    onChange={(e) =>
                      setFormData({ ...formData, sshKey: e.target.value })
                    }
                    className="w-full h-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground text-xs font-mono resize-none focus:outline-none focus:border-violet/50"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 bg-transparent border-white/10 hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isConnecting}
                  className="flex-1 bg-violet hover:bg-violet-600 text-white shadow-lg shadow-violet/20"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect VPS"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="py-8 text-center space-y-6">
              <div className="relative mx-auto w-20 h-20">
                <div className="absolute inset-0 rounded-full bg-violet/20 animate-ping" />
                <div className="relative w-20 h-20 rounded-full bg-violet/20 flex items-center justify-center border border-violet/50">
                  <Terminal className="w-8 h-8 text-violet" />
                </div>
              </div>

              <div className="max-w-xs mx-auto space-y-2">
                <h4 className="text-xl font-bold text-foreground">
                  Bootstrap Started
                </h4>
                <p className="text-sm text-muted-foreground text-center">
                  We've successfully reached your VPS. Initializing the
                  management agent...
                </p>
              </div>

              <div className="space-y-3 px-8">
                {[
                  { label: "Testing SSH credentials", status: "completed" },
                  { label: "Uploading bootstrap script", status: "completed" },
                  { label: "Running installation", status: "loading" },
                  { label: "Finalizing registration", status: "pending" },
                ].map((task, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs"
                  >
                    <span
                      className={cn(
                        "font-medium",
                        task.status === "completed"
                          ? "text-success"
                          : "text-muted-foreground",
                      )}
                    >
                      {task.label}
                    </span>
                    {task.status === "completed" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    )}
                    {task.status === "loading" && (
                      <Loader2 className="w-3.5 h-3.5 text-violet animate-spin" />
                    )}
                    {task.status === "pending" && (
                      <div className="w-3.5 h-3.5 rounded-full border border-white/20" />
                    )}
                  </div>
                ))}
              </div>

              <Button
                onClick={onClose}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-foreground"
              >
                Close & View Progress
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
