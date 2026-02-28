import { useEffect, useState } from "react";
import {
  User,
  Bell,
  Shield,
  Key,
  Save,
  Check,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuthStore } from "../store/authStore";
import { toast } from "sonner";
import api from '@/services/api';

interface SettingSection {
  id: string;
  label: string;
  icon: React.ElementType;
}

const sections: SettingSection[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "api", label: "API Keys", icon: Key },
];

export function Settings() {
  const [activeSection, setActiveSection] = useState("profile");
  const [saved, setSaved] = useState(false);
  const { user, logout } = useAuthStore();
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/auth/github/repos');
        if (!mounted) return;
        setGithubConnected(Array.isArray(res.data) && res.data.length > 0);
      } catch (e) {
        if (!mounted) return;
        setGithubConnected(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSave = () => {
    setSaved(true);
    toast.success("Settings updated successfully");
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-muted-foreground mt-1">
            Manage your account and preferences
          </p>
        </div>
        <Button
          variant="outline"
          onClick={logout}
          className="border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all",
                  activeSection === section.id
                    ? "bg-violet/20 text-violet"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                )}
              >
                <section.icon className="w-5 h-5" />
                <span className="font-medium text-sm">{section.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/20">
            {activeSection === "profile" && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Profile Settings
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Update your personal information
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet to-violet-700 flex items-center justify-center shadow-lg shadow-violet/20 overflow-hidden">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-white uppercase">
                        {user?.name?.charAt(0) || "U"}
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">
                      {user?.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      {user?.email}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white/5 border-white/10 text-xs h-8"
                      >
                        Change Avatar
                      </Button>
                      <Button
                        variant={githubConnected ? 'ghost' : 'outline'}
                        size="sm"
                        onClick={async () => {
                          if (githubConnected) {
                            try {
                              await api.post('/auth/github/disconnect');
                              setGithubConnected(false);
                              toast.success('Disconnected from GitHub');
                            } catch (e) {
                              toast.error('Failed to disconnect');
                            }
                          } else {
                            try {
                              const resp = await api.get('/auth/github/url');
                              const url = resp.data.url;
                              const popup = window.open(url, 'github_oauth', 'width=800,height=600');
                              if (!popup) {
                                toast.error('Popup blocked. Please allow popups.');
                                return;
                              }

                              const onMessage = (ev: MessageEvent) => {
                                try {
                                  if (ev.data && ev.data.type === 'github_connected') {
                                    setGithubConnected(true);
                                    toast.success('Connected to GitHub');
                                    try { popup.close(); } catch (e) {}
                                    window.removeEventListener('message', onMessage);
                                  }
                                } catch (e) {}
                              };
                              window.addEventListener('message', onMessage);

                              // Fallback timeout if message never arrives
                              const start = Date.now();
                              const fallback = setInterval(async () => {
                                try {
                                  const r = await api.get('/auth/github/repos');
                                  if (Array.isArray(r.data) && r.data.length > 0) {
                                    clearInterval(fallback);
                                    window.removeEventListener('message', onMessage);
                                    try { popup.close(); } catch (e) {}
                                    setGithubConnected(true);
                                    toast.success('Connected to GitHub');
                                  }
                                } catch (e) {
                                  // ignore
                                }
                                if (Date.now() - start > 25000) {
                                  clearInterval(fallback);
                                  window.removeEventListener('message', onMessage);
                                  toast.error('GitHub connection timed out.');
                                }
                              }, 2000);
                            } catch (e) {
                              toast.error('Failed to start GitHub OAuth');
                            }
                          }
                        }}
                        className="h-8"
                      >
                        {githubConnected ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Connected
                          </>
                        ) : (
                          'Connect to GitHub'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Display Name
                    </label>
                    <Input
                      defaultValue={user?.name}
                      className="bg-dark/50 border-white/10 text-foreground focus:border-violet/50"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <Input
                      defaultValue={user?.email}
                      type="email"
                      readOnly
                      className="bg-dark/50 border-white/10 text-muted-foreground opacity-70 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === "notifications" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Notifications
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Manage your notification preferences
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      id: "deployments",
                      label: "Deployment Status",
                      description: "Get notified of success/failures",
                    },
                    {
                      id: "alerts",
                      label: "System Alerts",
                      description: "High resource usage warnings",
                    },
                    {
                      id: "billing",
                      label: "Billing",
                      description: "Invoices and usage limit alerts",
                    },
                  ].map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-transparent hover:border-white/10 transition-colors"
                    >
                      <div>
                        <div className="font-medium text-foreground text-sm">
                          {item.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === "api" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    API Access
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Programmatic interaction with your resources
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-violet/5 border border-violet/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-violet" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        Personal Access Token
                      </div>
                      <div className="text-xs text-muted-foreground">
                        vps_live_••••••••••••••••••••••••
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs">
                    Reveal
                  </Button>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-8 mt-8 border-t border-white/10 flex justify-end">
              <Button
                onClick={handleSave}
                disabled={activeSection === "api"}
                className={cn(
                  "px-8 transition-all active:scale-[0.98]",
                  saved
                    ? "bg-success hover:bg-success text-white"
                    : "bg-violet hover:bg-violet-600 text-white shadow-lg shadow-violet/20",
                )}
              >
                {saved ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
