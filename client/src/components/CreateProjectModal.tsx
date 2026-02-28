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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderGit2, GitBranch, Box, Loader2 } from "lucide-react";
import { useProjectMutations } from "../hooks/useApi";
import api from "@/services/api";
import { toast } from "sonner";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  serverId: string;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onSuccess,
  serverId,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("static");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [dockerImage, setDockerImage] = useState("");
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [showRepoPicker, setShowRepoPicker] = useState(false);

  const { createProject, isCreating } = useProjectMutations();

  const handleCreate = async () => {
    if (!name) {
      toast.error("Project name is required");
      return;
    }

    try {
      await createProject({
        name,
        description,
        type,
        serverId,
        repositoryUrl: type === "static" ? repositoryUrl : undefined,
        dockerImage: type === "docker" ? dockerImage : undefined,
      });
      toast.success("Project created successfully");
      setName("");
      setDescription("");
      setRepositoryUrl("");
      setDockerImage("");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast.error("Failed to create project");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-dark/95 backdrop-blur-xl border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-violet" />
            Create New Project
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Group your deployments and manage your application lifecycle.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Name</label>
            <Input
              placeholder="e.g. My Awesome App"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Description (Optional)
            </label>
            <Input
              placeholder="A brief description of your project"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white/5 border-white/10"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Project Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="bg-white/5 border-white/10">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-dark/95 border-white/10 text-white">
                <SelectItem value="static">Static App (from Git)</SelectItem>
                <SelectItem value="docker">Docker Application</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "static" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-violet" />
                GitHub Repository URL
              </label>

              {/* INPUT + BUTTON */}
              <div className="flex gap-2">
                <Input
                  placeholder="https://github.com/user/repo.git"
                  value={repositoryUrl}
                  onChange={(e) => setRepositoryUrl(e.target.value)}
                  className="flex-1 bg-white/5 border-white/10"
                />

                <button
                  onClick={async () => {
                    try {
                      const res = await api.get("/auth/github/repos");
                      const data = res.data;

                      if (Array.isArray(data)) {
                        setGithubRepos(data);
                        setShowRepoPicker(true);
                        return;
                      }
                    } catch {}

                    try {
                      const urlRes = await api.get("/auth/github/url");
                      window.open(urlRes.data.url, "_blank");
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="px-3 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground"
                >
                  Choose
                </button>
              </div>

              {/* INLINE REPO PICKER */}
              {showRepoPicker && (
                <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-white/5">
                  {githubRepos.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No repositories found
                    </div>
                  )}

                  {githubRepos.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setRepositoryUrl(r.clone_url);
                        setName((prev) => prev || r.name); // nice UX auto-fill
                        setShowRepoPicker(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-white/10 border-b border-white/5 last:border-none"
                    >
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs opacity-60 truncate">
                        {r.clone_url}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {type === "docker" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Box className="w-4 h-4 text-violet" />
                Docker Image
              </label>

              <Input
                placeholder="e.g. nginx:alpine or user/image:tag"
                value={dockerImage}
                onChange={(e) => setDockerImage(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            className="hover:bg-white/5 text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating}
            className="bg-violet hover:bg-violet-600 text-white px-8"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Project"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
