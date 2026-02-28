import { useState } from "react";
import {
  FolderGit2,
  Plus,
  MoreVertical,
  GitBranch,
  Rocket,
  Settings,
  ExternalLink,
  RefreshCcw,
  Box,
  Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjects } from "../hooks/useApi";
import { CreateProjectModal } from "../components/CreateProjectModal";
import { DeployTemplateModal } from "../components/DeployTemplateModal";

interface ProjectsProps {
  serverId: string;
  onProjectClick?: (id: string) => void;
}

export function Projects({ serverId, onProjectClick }: ProjectsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: projects, isLoading } = useProjects(serverId);

  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);

  const filteredProjects = (projects || []).filter(
    (project: any) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "text-success bg-success/20 border-success/30";
      case "paused":
        return "text-warning bg-warning/20 border-warning/30";
      case "error":
        return "text-destructive bg-destructive/20 border-destructive/30";
      default:
        return "text-muted-foreground bg-white/10";
    }
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <RefreshCcw className="w-8 h-8 text-violet animate-spin" />
        <p className="text-muted-foreground">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Projects</h2>
          <p className="text-muted-foreground mt-1">
            Manage your applications and services
          </p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="h-10 px-4 bg-violet hover:bg-violet-600 text-white transition-all hover:shadow-glow"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-2 gap-4">
        {filteredProjects.map((project: any) => (
          <div
            key={project.id}
            onClick={() => onProjectClick?.(project.id)}
            className={cn(
              "relative rounded-2xl border p-5 transition-all duration-300 group cursor-pointer",
              "bg-white/[0.03] border-white/10 hover:border-violet/30 hover:bg-white/[0.05]",
            )}
          >
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-violet/20 flex items-center justify-center shrink-0">
                    {project.type === "docker" ? (
                      <Box className="w-6 h-6 text-violet" />
                    ) : (
                      <FolderGit2 className="w-6 h-6 text-violet" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-violet transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {project.description || "No description provided"}
                    </p>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-dark/95 backdrop-blur-xl border-white/10"
                  >
                    <DropdownMenuItem className="cursor-pointer hover:bg-white/5">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer hover:bg-white/5">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem className="cursor-pointer text-destructive hover:bg-destructive/10">
                      Delete Project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/5 p-2 rounded-lg">
                  <Rocket className="w-3.5 h-3.5 text-violet" />
                  <span>{project.deployments?.length || 0} deploys</span>
                </div>
                {project.type === "static" && project.repositoryUrl && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/5 p-2 rounded-lg overflow-hidden">
                    <GitBranch className="w-3.5 h-3.5 text-violet shrink-0" />
                    <span className="truncate" title={project.repositoryUrl}>
                      {project.repositoryUrl.split("/").pop()}
                    </span>
                  </div>
                )}
                {project.type === "docker" && project.dockerImage && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/5 p-2 rounded-lg overflow-hidden">
                    <Box className="w-3.5 h-3.5 text-violet shrink-0" />
                    <span className="truncate" title={project.dockerImage}>
                      {project.dockerImage}
                    </span>
                  </div>
                )}
                {!project.repositoryUrl && !project.dockerImage && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/5 p-2 rounded-lg">
                    <Link className="w-3.5 h-3.5 text-muted-foreground/50" />
                    <span>No source linked</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-medium border capitalize",
                      getStatusColor("active"),
                    )}
                  >
                    {project.type || "Static"}
                  </span>
                  <span className="text-xs text-muted-foreground opacity-60">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProject(project);
                    setIsDeployModalOpen(true);
                  }}
                  size="sm"
                  className="h-8 bg-violet/10 hover:bg-violet text-violet hover:text-white border border-violet/20 transition-all"
                >
                  <Rocket className="w-3.5 h-3.5 mr-1.5" />
                  Deploy
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
          <FolderGit2 className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            No projects found
          </h3>
          <p className="text-sm text-muted-foreground">
            Create a new project to get started
          </p>
        </div>
      )}

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        serverId={serverId}
      />

      <DeployTemplateModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        project={selectedProject}
        serverId={serverId}
      />
    </div>
  );
}
