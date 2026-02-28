import { useState } from "react";
import {
  Search,
  ArrowUpRight,
  Plus,
  Server,
  Layers,
  RefreshCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTemplates, useDeploymentMutations } from "../hooks/useApi";
import { DeployTemplateModal } from "../components/DeployTemplateModal";

interface TemplatesProps {
  onDeployClick: () => void;
  serverId: string;
}

const categories = ["All", "Frontend", "Backend", "Database", "Docker"];

export function Templates({ onDeployClick, serverId }: TemplatesProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);

  const { data: templates, isLoading } = useTemplates();
  const { isCreating } = useDeploymentMutations();

  const filteredTemplates = (templates || []).filter((template: any) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || template.os === selectedCategory; // Mapping category to OS for now
    return matchesSearch && matchesCategory;
  });

  const handleDeploy = (template: any) => {
    setSelectedTemplate(template);
    setIsDeployModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <RefreshCcw className="w-8 h-8 text-violet animate-spin" />
        <p className="text-muted-foreground">Loading templates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Template Marketplace
          </h2>
          <p className="text-muted-foreground mt-1">
            Deploy applications in minutes with pre-configured templates
          </p>
        </div>
        <Button className="h-10 px-4 bg-violet hover:bg-violet-600 text-white transition-all hover:shadow-glow">
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="flex gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                selectedCategory === category
                  ? "bg-violet/20 text-violet border border-violet/30"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent",
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-4">
        {filteredTemplates.map((template: any) => (
          <div
            key={template.id}
            onMouseEnter={() => setHoveredTemplate(template.id)}
            onMouseLeave={() => setHoveredTemplate(null)}
            className={cn(
              "relative rounded-2xl border p-5 transition-all duration-300 group",
              "bg-white/[0.03] border-white/10 hover:border-violet/30 hover:bg-white/[0.05]",
            )}
          >
            {hoveredTemplate === template.id && (
              <div className="absolute inset-0 rounded-2xl bg-violet/5 blur-xl" />
            )}

            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-violet/20 flex items-center justify-center">
                  <Server className="w-6 h-6 text-violet" />
                </div>
              </div>

              <h4 className="font-semibold text-foreground group-hover:text-violet transition-colors mb-1">
                {template.name}
              </h4>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {template.description}
              </p>

              <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                <div className="flex items-center gap-1 text-violet">
                  OS: {template.os}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleDeploy(template)}
                  disabled={isCreating}
                  size="sm"
                  className="flex-1 h-9 bg-violet hover:bg-violet-600 text-white text-xs"
                >
                  {isCreating ? "Deploying..." : "Deploy"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 bg-white/5 border-white/10 hover:bg-white/10"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
          <Layers className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            No templates found
          </h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search or filters
          </p>
        </div>
      )}
      <DeployTemplateModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        onSuccess={onDeployClick}
        template={selectedTemplate}
        serverId={serverId}
      />
    </div>
  );
}
