import { useState } from "react";
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
import {
  Check,
  ShieldCheck,
  GitBranch,
  Rocket,
} from "lucide-react";
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
  const { data: templates } = useTemplates();
  const { createDeployment, isCreating } = useDeploymentMutations();

  const handleDeploy = async () => {
    const templateId = selectedTemplateId || initialTemplate?.id;
    if (!templateId) {
      toast.error("Please select a template");
      return;
    }

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
