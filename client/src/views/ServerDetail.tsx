import { useState, useRef, useEffect } from "react";
import {
  Power,
  RefreshCw,
  Settings,
  Terminal,
  Activity,
  Database,
  FolderOpen,
  Cpu,
  MemoryStick,
  HardDrive,
  Globe,
  Play,
  Square,
  RotateCcw,
  MoreHorizontal,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Server as ServerType } from "@/App";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { useServerStats, useTerminalCommand } from "../hooks/useApi";

import { DockerManagement } from "../components/DockerManagement";
import { FileManager } from "../components/FileManager";

interface ServerDetailProps {
  server: ServerType;
}

// Historical data placeholders removed in favor of live polling

export function ServerDetail({ server }: ServerDetailProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "Welcome to VPSHub Terminal",
    `Connected to ${server.name} (${server.ip})`,
    'Type "help" for available commands',
    "",
  ]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const { data: stats } = useServerStats(server.id);
  const { executeCommand } = useTerminalCommand(server.id);

  const [liveCpuData, setLiveCpuData] = useState<
    { time: string; value: number }[]
  >([]);
  const [liveMemData, setLiveMemData] = useState<
    { time: string; value: number }[]
  >([]);

  useEffect(() => {
    if (stats) {
      const now = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLiveCpuData((prev) => [
        ...prev.slice(-19),
        { time: now, value: stats.cpu },
      ]);
      setLiveMemData((prev) => [
        ...prev.slice(-19),
        { time: now, value: stats.memory },
      ]);
    }
  }, [stats]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLines]);

  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const command = terminalInput;
    setTerminalLines((prev) => [...prev, `$ ${command}`]);
    setTerminalInput("");

    try {
      const response = await executeCommand(command);
      if (response.output) {
        setTerminalLines((prev) => [...prev, ...response.output.split("\n")]);
      } else {
        setTerminalLines((prev) => [...prev, "(No output)"]);
      }
    } catch (error: any) {
      setTerminalLines((prev) => [
        ...prev,
        `Error: ${error.response?.data?.message || error.message}`,
      ]);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-4 h-4 rounded-full",
                server.status === "online" &&
                  "bg-success shadow-[0_0_8px_hsl(var(--success))]",
                server.status === "offline" &&
                  "bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]",
                server.status === "warning" &&
                  "bg-warning shadow-[0_0_8px_hsl(var(--warning))]",
              )}
            />
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {server.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {server.ip} • {server.region}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-foreground"
          >
            <Power className="w-4 h-4 mr-2" />
            {server.status === "online" ? "Stop" : "Start"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-white/5 border-white/10 hover:bg-white/10 text-foreground"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Restart
          </Button>
          <Button
            size="sm"
            className="bg-violet hover:bg-violet-600 text-white"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white/5 border border-white/10 p-1">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-violet/20 data-[state=active]:text-violet"
          >
            <Activity className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="terminal"
            className="data-[state=active]:bg-violet/20 data-[state=active]:text-violet"
          >
            <Terminal className="w-4 h-4 mr-2" />
            Terminal
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="data-[state=active]:bg-violet/20 data-[state=active]:text-violet"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Files
          </TabsTrigger>
          <TabsTrigger
            value="docker"
            className="data-[state=active]:bg-violet/20 data-[state=active]:text-violet"
          >
            <Database className="w-4 h-4 mr-2" />
            Docker
          </TabsTrigger>
          <TabsTrigger
            value="metrics"
            className="data-[state=active]:bg-violet/20 data-[state=active]:text-violet"
          >
            <Activity className="w-4 h-4 mr-2" />
            Metrics
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Resource Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet/20 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-violet" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">CPU Usage</div>
                  <div className="text-2xl font-bold text-foreground">
                    {stats?.cpu ?? server.cpu}%
                  </div>
                </div>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    (stats?.cpu ?? server.cpu) > 80
                      ? "bg-warning"
                      : "bg-violet",
                  )}
                  style={{ width: `${stats?.cpu ?? server.cpu}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet/20 flex items-center justify-center">
                  <MemoryStick className="w-5 h-5 text-violet" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Memory</div>
                  <div className="text-2xl font-bold text-foreground">
                    {stats?.memory ?? server.memory}%
                  </div>
                </div>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    (stats?.memory ?? server.memory) > 80
                      ? "bg-warning"
                      : "bg-violet",
                  )}
                  style={{ width: `${stats?.memory ?? server.memory}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet/20 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-violet" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Disk Usage
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {server.disk}%
                  </div>
                </div>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet transition-all duration-500"
                  style={{ width: `${server.disk}%` }}
                />
              </div>
            </div>
          </div>

          {/* Services & Ports */}
          <div className="grid grid-cols-2 gap-6">
            {/* Running Services */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Play className="w-4 h-4 text-violet" />
                  Running Services
                </h3>
                <button className="text-sm text-violet hover:text-violet-400">
                  View all
                </button>
              </div>

              <div className="space-y-2">
                {(stats?.services || []).map((service: any) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full shadow-[0_0_6px_currentColor]",
                          service.status === "active"
                            ? "text-success bg-success"
                            : "text-destructive bg-destructive",
                        )}
                      />
                      <span className="font-medium text-foreground capitalize">
                        {service.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {service.port && (
                        <span className="text-xs text-muted-foreground">
                          Port {service.port}
                        </span>
                      )}
                      <div className="flex gap-1">
                        <button className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors">
                          <Square className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors">
                          <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {(!stats?.services || stats.services.length === 0) && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No services detected
                  </div>
                )}
              </div>
            </div>

            {/* Open Ports */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Globe className="w-4 h-4 text-violet" />
                  Open Ports
                </h3>
                <button className="text-sm text-violet hover:text-violet-400">
                  Manage
                </button>
              </div>

              <div className="space-y-2">
                {(stats?.ports || []).map((port: any) => (
                  <div
                    key={port.port}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-12 text-center font-mono text-sm text-violet">
                        {port.port}
                      </span>
                      <span className="text-sm text-foreground">
                        {port.service}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-muted-foreground">
                      {port.type}
                    </span>
                  </div>
                ))}
                {(!stats?.ports || stats.ports.length === 0) && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No open ports detected
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Terminal Tab */}
        <TabsContent value="terminal" className="mt-6">
          <div className="rounded-2xl border border-white/10 bg-[#0d1117] overflow-hidden">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-violet" />
                <span className="text-sm text-foreground">Terminal</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center">
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Terminal Content */}
            <div className="p-4 font-mono text-sm h-[400px] overflow-y-auto scrollbar-thin">
              {terminalLines.map((line, index) => (
                <div key={index} className="py-0.5">
                  {line.startsWith("$") ? (
                    <span className="text-success">{line}</span>
                  ) : line.match(
                      /^(Server|Status|CPU|Memory|Disk|PID|Filesystem):/,
                    ) ? (
                    <span className="text-violet">{line}</span>
                  ) : (
                    <span className="text-foreground/80">{line}</span>
                  )}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>

            {/* Terminal Input */}
            <form
              onSubmit={handleTerminalSubmit}
              className="flex items-center gap-2 px-4 py-3 border-t border-white/10 bg-white/5"
            >
              <span className="text-success font-mono text-sm">$</span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                className="flex-1 bg-transparent text-foreground font-mono text-sm outline-none placeholder:text-muted-foreground/50"
                placeholder="Type a command..."
                autoFocus
              />
              <button
                type="submit"
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <Send className="w-4 h-4 text-violet" />
              </button>
            </form>
          </div>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="mt-6">
          <FileManager serverId={server.id} />
        </TabsContent>

        {/* Docker Tab */}
        <TabsContent value="docker" className="mt-6">
          <DockerManagement serverId={server.id} />
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* CPU Chart */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="font-semibold text-foreground mb-4">
                Real-time CPU Usage
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={liveCpuData}>
                    <defs>
                      <linearGradient
                        id="cpuGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#7B61FF"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#7B61FF"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <XAxis
                      dataKey="time"
                      stroke="rgba(255,255,255,0.3)"
                      fontSize={10}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="rgba(255,255,255,0.3)"
                      fontSize={10}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0E111A",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#A7ACBF" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#7B61FF"
                      fillOpacity={1}
                      fill="url(#cpuGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Memory Chart */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="font-semibold text-foreground mb-4">
                Real-time Memory Usage
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={liveMemData}>
                    <defs>
                      <linearGradient
                        id="memGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#27C59A"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#27C59A"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <XAxis
                      dataKey="time"
                      stroke="rgba(255,255,255,0.3)"
                      fontSize={10}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="rgba(255,255,255,0.3)"
                      fontSize={10}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0E111A",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#A7ACBF" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#27C59A"
                      fillOpacity={1}
                      fill="url(#memGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
