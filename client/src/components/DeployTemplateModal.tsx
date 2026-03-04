import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ShieldCheck, GitBranch, Rocket, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeploymentMutations, useTemplates } from "../hooks/useApi";
import { toast } from "sonner";

interface DeployTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  project?: any; // Now optional, if project is passed we are deploying that project
  template?: any; // Existing behavior: template pre-selected from Marketplace
  serverId: string;
}

export function DeployTemplateModal({
  isOpen,
  onClose,
  onSuccess,
  project,
  template: initialTemplate,
  serverId,
}: DeployTemplateModalProps) {
  const [domain, setDomain] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    initialTemplate?.id || "",
  );
  const [startCmd, setStartCmd] = useState("");
  const [buildCmd, setBuildCmd] = useState("");
  const [installCmd, setInstallCmd] = useState("");
  const [rootDir, setRootDir] = useState("");
  const [envVars, setEnvVars] = useState([{ key: "", value: "" }]);
  const { data: templates } = useTemplates();
  const { createDeployment, isCreating } = useDeploymentMutations();
  const selectedTemplate =
    (templates || []).find((t: any) => t.id === selectedTemplateId) ||
    initialTemplate;
  const isNodeTemplate = selectedTemplate?.type === "NODE";

  useEffect(() => {
    if (!isNodeTemplate) {
      setStartCmd("");
      setBuildCmd("");
      setInstallCmd("");
      setRootDir("");
      return;
    }

    setStartCmd((prev) => prev || selectedTemplate?.startCmd || "");
    setBuildCmd((prev) => prev || selectedTemplate?.buildCmd || "");
    setInstallCmd((prev) => prev || selectedTemplate?.installCmd || "");
  }, [isNodeTemplate, selectedTemplate?.id]);

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "" }]);
  };

  const updateEnvVar = (
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    const newEnvVars = [...envVars];
    newEnvVars[index][field] = value;
    setEnvVars(newEnvVars);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const handleDeploy = async () => {
    const templateId = selectedTemplateId || initialTemplate?.id;
    if (!templateId) {
      toast.error("Please select a template");
      return;
    }

    if (isNodeTemplate && !startCmd && !selectedTemplate?.startCmd) {
      toast.error("Start command is required for Node deployments");
      return;
    }

    // Format env vars to Record<string, string>
    const formattedEnv = envVars.reduce((acc: any, { key, value }) => {
      if (key.trim()) acc[key.trim()] = value;
      return acc;
    }, {});

    try {
      await createDeployment({
        serverId,
        projectId: project?.id,
        templateId: templateId,
        name: project?.name, // Use project name or fallback in DTO logic
        domain: domain || undefined,
        // Inherit from project or current state
        repositoryUrl: project?.repositoryUrl,
        dockerImage: project?.dockerImage,
        startCmd: isNodeTemplate ? startCmd || undefined : undefined,
        buildCmd: isNodeTemplate ? buildCmd || undefined : undefined,
        installCmd: isNodeTemplate ? installCmd || undefined : undefined,
        rootDir: isNodeTemplate ? rootDir || undefined : undefined,
        env: Object.keys(formattedEnv).length > 0 ? formattedEnv : undefined,
      });
      toast.success(`Deployment started for ${project?.name || "template"}`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast.error("Failed to start deployment");
    }
  };

  const filteredTemplates = (templates || []).filter((t: any) => {
    if (!project) return true;
    if (project.type === "docker") return t.type === "DOCKER";
    return t.type === "STATIC" || t.type === "NODE";
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-dark/95 backdrop-blur-xl border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-violet" />
            Deploy {project?.name || initialTemplate?.name}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure how you want to deploy this{" "}
            {project ? "project" : "template"}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Check className="w-4 h-4 text-violet" />
              Select Template
            </label>
            <Select
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent className="bg-dark/95 border-white/10 text-white">
                {filteredTemplates.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-violet" />
              Custom Domain (Optional)
            </label>
            <Input
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50"
            />
          </div>

          {isNodeTemplate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Start Command
                </label>
                <Input
                  placeholder={selectedTemplate?.startCmd || "npm run start"}
                  value={startCmd}
                  onChange={(e) => setStartCmd(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Build Command (Optional)
                </label>
                <Input
                  placeholder={selectedTemplate?.buildCmd || "npm run build"}
                  value={buildCmd}
                  onChange={(e) => setBuildCmd(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Install Command (Optional)
                </label>
                <Input
                  placeholder={selectedTemplate?.installCmd || "npm install"}
                  value={installCmd}
                  onChange={(e) => setInstallCmd(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Root Directory (Optional)
                </label>
                <Input
                  placeholder="e.g. apps/api"
                  value={rootDir}
                  onChange={(e) => setRootDir(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Environment Variables */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">
                    Environment Variables
                  </label>
                  <button
                    onClick={addEnvVar}
                    className="text-xs text-violet hover:text-violet-400"
                  >
                    + Add Variable
                  </button>
                </div>
                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                  {envVars.map((envVar, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="KEY"
                        value={envVar.key}
                        onChange={(e) =>
                          updateEnvVar(index, "key", e.target.value)
                        }
                        className="flex-1 bg-white/5 border-white/10 text-white text-xs"
                      />
                      <Input
                        placeholder="VALUE"
                        value={envVar.value}
                        onChange={(e) =>
                          updateEnvVar(index, "value", e.target.value)
                        }
                        className="flex-1 bg-white/5 border-white/10 text-white text-xs"
                      />
                      {envVars.length > 1 && (
                        <button
                          onClick={() => removeEnvVar(index)}
                          className="px-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-violet/5 border border-violet/10 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-violet shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">
                Automatic Configuration
              </p>
              <p>
                We'll handle the Nginx reverse proxy, port mapping, and security
                headers automatically based on the template.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={onClose}
            className="hover:bg-white/5 text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeploy}
            disabled={isCreating}
            className="bg-violet hover:bg-violet-600 text-white shadow-glow-sm px-8"
          >
            {isCreating ? "Deploying..." : "Confirm Deployment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
