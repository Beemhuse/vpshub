import { useState } from "react";
import {
  X,
  Search,
  ArrowRight,
  Check,
  Globe,
  Database,
  Box,
  Code2,
  Server,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import api from "@/services/api";

interface DeployModalProps {
  open: boolean;
  onClose: () => void;
  serverId?: string | null;
}

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: string;
  tags: string[];
  type?: "NODE" | "STATIC" | "DOCKER" | "DATABASE";
}

const templates: Template[] = [
  {
    id: "nextjs",
    name: "Next.js",
    description: "Full-stack React framework with App Router",
    icon: Code2,
    category: "Frontend",
    tags: ["React", "SSR", "TypeScript"],
    type: "NODE",
  },
  {
    id: "node-api",
    name: "Node.js API",
    description: "Express REST API with TypeScript",
    icon: Server,
    category: "Backend",
    tags: ["Express", "REST", "TypeScript"],
    type: "NODE",
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Managed PostgreSQL database",
    icon: Database,
    category: "Database",
    tags: ["SQL", "Relational"],
    type: "DATABASE",
  },
  {
    id: "redis",
    name: "Redis",
    description: "In-memory data store and cache",
    icon: Database,
    category: "Database",
    tags: ["Cache", "NoSQL"],
    type: "DATABASE",
  },
  {
    id: "docker-compose",
    name: "Docker Compose",
    description: "Multi-container application stack",
    icon: Box,
    category: "Docker",
    tags: ["Containers", "Multi-service"],
    type: "DOCKER",
  },
  {
    id: "static-site",
    name: "Static Site",
    description: "Nginx-powered static site hosting",
    icon: Globe,
    category: "Frontend",
    tags: ["Nginx", "Static"],
    type: "STATIC",
  },
];

const categories = ["All", "Frontend", "Backend", "Database", "Docker"];

export function DeployModal({ open, onClose, serverId }: DeployModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [step, setStep] = useState<"select" | "configure" | "deploying">(
    "select",
  );
  const [domain, setDomain] = useState("");
  const [repositoryUrlState, setRepositoryUrlState] = useState("");
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [envVars, setEnvVars] = useState([{ key: "", value: "" }]);
  const [startCmd, setStartCmd] = useState("");
  const [buildCmd, setBuildCmd] = useState("");
  const [installCmd, setInstallCmd] = useState("");
  const [rootDir, setRootDir] = useState("");
  const [exposedPort, setExposedPort] = useState("");
  const isNodeTemplate = selectedTemplate?.type === "NODE";
  const isDockerTemplate = selectedTemplate?.type === "DOCKER";

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setStep("configure");
    setStartCmd("");
    setBuildCmd("");
    setInstallCmd("");
    setRootDir("");
    setExposedPort("");
  };

  const handleDeploy = async () => {
    if (!selectedTemplate) return;
    if (!repositoryUrlState && !selectedTemplate) return;
    if (isNodeTemplate && !startCmd) {
      alert("Start command is required for Node deployments.");
      return;
    }

    setStep("deploying");

    try {
      const payload: any = {
        serverId: {} as any,
        repositoryUrl: repositoryUrlState || undefined,
        domain: domain || undefined,
        templateId: selectedTemplate.id,
        startCmd: isNodeTemplate ? startCmd || undefined : undefined,
        buildCmd: isNodeTemplate || isDockerTemplate ? buildCmd || undefined : undefined,
        installCmd: isNodeTemplate ? installCmd || undefined : undefined,
        rootDir: isNodeTemplate || isDockerTemplate ? rootDir || undefined : undefined,
        exposedPort: isDockerTemplate && exposedPort ? Number(exposedPort) : undefined,
        env: envVars.reduce((acc: any, { key, value }) => {
          if (key.trim()) acc[key.trim()] = value;
          return acc;
        }, {}),
      };
      if (Object.keys(payload.env).length === 0) delete payload.env;

      // serverId will be provided by parent via props in the component usage
      // we don't have direct access to the prop variable here unless passed in
      // so use a dataset attribute by reading from window state
      // Instead, expect parent to pass serverId via props (see App.tsx update)
      // We'll read it from arguments via closure using a prop.
      // The `serverId` prop is available in the component props.
      // @ts-ignore
      if ((arguments as any).length === 0) {
        // no-op
      }

      const serverIdFinal =
        serverId ||
        (localStorage.getItem("vpshub_selectedServer")
          ? JSON.parse(localStorage.getItem("vpshub_selectedServer") as string)
              .id
          : null);
      payload.serverId = serverIdFinal;

      const res = await api.post("/deployments", payload);
      const deployment = res.data;
      // Show quick feedback and close
      alert(
        `Deployment started. Preview domain: ${deployment.domain || "N/A"}`,
      );
      onClose();
      setStep("select");
      setSelectedTemplate(null);
      setDomain("");
      setEnvVars([{ key: "", value: "" }]);
      setStartCmd("");
      setBuildCmd("");
      setInstallCmd("");
      setRootDir("");
      setExposedPort("");
    } catch (e) {
      console.error(e);
      alert("Failed to start deployment");
      setStep("configure");
    }
  };

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-dark-100 border-white/10 p-0">
        <DialogHeader className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-foreground">
              {step === "select" && "Deploy Template"}
              {step === "configure" && "Configure Deployment"}
              {step === "deploying" && "Deploying..."}
            </DialogTitle>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </DialogHeader>

        {step === "select" && (
          <div className="p-6">
            {/* Search and Filters */}
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                    selectedCategory === category
                      ? "bg-violet/20 text-violet border border-violet/30"
                      : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent",
                  )}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className="flex items-start gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet/30 transition-all text-left group"
                >
                  <div className="w-12 h-12 rounded-xl bg-violet/20 flex items-center justify-center flex-shrink-0 group-hover:bg-violet/30 transition-colors">
                    <template.icon className="w-6 h-6 text-violet" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {template.name}
                      </h3>
                      <ArrowRight className="w-4 h-4 text-violet opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {template.description}
                    </p>
                    <div className="flex gap-2 mt-3">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "configure" && selectedTemplate && (
          <div className="p-6">
            <button
              onClick={() => setStep("select")}
              className="text-sm text-violet hover:text-violet-400 mb-4 flex items-center gap-1"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Back to templates
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl bg-violet/20 flex items-center justify-center">
                <selectedTemplate.icon className="w-7 h-7 text-violet" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {selectedTemplate.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedTemplate.description}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Domain Input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Domain
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="your-app.example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="flex-1 bg-white/5 border-white/10 text-foreground"
                  />
                </div>
              </div>

              {/* Repository selection (GitHub) */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Repository
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Repository URL or select from GitHub"
                    value={repositoryUrlState}
                    onChange={(e) => setRepositoryUrlState(e.target.value)}
                    className="flex-1 bg-white/5 border-white/10 text-foreground"
                  />
                  <button
                    onClick={async () => {
                      try {
                        const res = await api.get("/auth/github/repos");
                        const data = res.data;
                        if (Array.isArray(data) && data.length > 0) {
                          setGithubRepos(data);
                          setShowRepoPicker(true);
                          return;
                        }
                      } catch (e) {
                        // ignore and fallthrough to open auth URL
                      }

                      try {
                        const urlRes = await api.get("/auth/github/url");
                        const { url } = urlRes.data;
                        window.open(url, "_blank", "noopener");
                      } catch (e) {
                        console.error("Failed to open GitHub auth URL", e);
                      }
                    }}
                    className="px-3 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground"
                  >
                    Choose from GitHub
                  </button>
                </div>
              </div>

              {isNodeTemplate && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Start Command
                    </label>
                    <Input
                      placeholder="npm run start"
                      value={startCmd}
                      onChange={(e) => setStartCmd(e.target.value)}
                      className="flex-1 bg-white/5 border-white/10 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Build Command (Optional)
                    </label>
                    <Input
                      placeholder="npm run build"
                      value={buildCmd}
                      onChange={(e) => setBuildCmd(e.target.value)}
                      className="flex-1 bg-white/5 border-white/10 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Install Command (Optional)
                    </label>
                    <Input
                      placeholder="npm install"
                      value={installCmd}
                      onChange={(e) => setInstallCmd(e.target.value)}
                      className="flex-1 bg-white/5 border-white/10 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Root Directory (Optional)
                    </label>
                    <Input
                      placeholder="e.g. apps/api"
                      value={rootDir}
                      onChange={(e) => setRootDir(e.target.value)}
                      className="flex-1 bg-white/5 border-white/10 text-foreground"
                    />
                  </div>
                </div>
              )}

              {isDockerTemplate && repositoryUrlState && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-violet/10 border border-violet/20 flex gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet/20 flex items-center justify-center flex-shrink-0">
                      <Box className="w-5 h-5 text-violet" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Docker Smart Deployment</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        We'll automatically detect your services. <strong>Frontends</strong> and <strong>APIs</strong> will get their own subdomains (e.g. <code>frontend.{domain || "your-app.nip.io"}</code>) via Traefik.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Root Directory
                      </label>
                      <Input
                        placeholder="."
                        value={rootDir}
                        onChange={(e) => setRootDir(e.target.value)}
                        className="flex-1 bg-white/5 border-white/10 text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Exposed Port
                      </label>
                      <Input
                        type="number"
                        placeholder="80"
                        value={exposedPort}
                        onChange={(e) => setExposedPort(e.target.value)}
                        className="flex-1 bg-white/5 border-white/10 text-foreground"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Custom Dockerfile Path (Optional)
                    </label>
                    <Input
                      placeholder="Dockerfile"
                      value={buildCmd}
                      onChange={(e) => setBuildCmd(e.target.value)}
                      className="flex-1 bg-white/5 border-white/10 text-foreground"
                    />
                  </div>
                </div>
              )}

              {/* Environment Variables */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">
                    Environment Variables
                  </label>
                  <button
                    onClick={addEnvVar}
                    className="text-sm text-violet hover:text-violet-400"
                  >
                    + Add Variable
                  </button>
                </div>
                <div className="space-y-2">
                  {envVars.map((envVar, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="KEY"
                        value={envVar.key}
                        onChange={(e) =>
                          updateEnvVar(index, "key", e.target.value)
                        }
                        className="flex-1 bg-white/5 border-white/10 text-foreground text-sm"
                      />
                      <Input
                        placeholder="value"
                        value={envVar.value}
                        onChange={(e) =>
                          updateEnvVar(index, "value", e.target.value)
                        }
                        className="flex-1 bg-white/5 border-white/10 text-foreground text-sm"
                      />
                      {envVars.length > 1 && (
                        <button
                          onClick={() => removeEnvVar(index)}
                          className="px-3 rounded-lg bg-white/5 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Deploy Button */}
              <Button
                onClick={handleDeploy}
                className="w-full h-11 bg-violet hover:bg-violet-600 text-white font-medium rounded-xl transition-all hover:shadow-glow"
              >
                <Check className="w-4 h-4 mr-2" />
                Deploy {selectedTemplate.name}
              </Button>
            </div>
            {showRepoPicker && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="w-full max-w-2xl bg-dark-100 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">
                      Select a GitHub repository
                    </h3>
                    <button
                      onClick={() => setShowRepoPicker(false)}
                      className="text-muted-foreground"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {githubRepos.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setRepositoryUrlState(r.clone_url);
                          setShowRepoPicker(false);
                        }}
                        className="w-full text-left p-3 rounded-lg hover:bg-white/5 border border-white/5"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.clone_url}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "deploying" && selectedTemplate && (
          <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-violet/20" />
              <div className="absolute inset-0 rounded-full border-4 border-violet border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <selectedTemplate.icon className="w-8 h-8 text-violet" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Deploying {selectedTemplate.name}...
            </h3>
            <p className="text-sm text-muted-foreground">
              This may take a few moments
            </p>
            <div className="mt-6 w-64 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-violet animate-[shimmer_2s_linear_infinite]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, #7B61FF, transparent)",
                  backgroundSize: "200% 100%",
                }}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
