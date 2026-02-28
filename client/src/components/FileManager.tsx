import { useState } from "react";
import {
  Folder,
  File,
  ChevronRight,
  ArrowLeft,
  MoreVertical,
  Plus,
  Trash2,
  Download,
  Edit2,
  RefreshCcw,
  Loader2,
  HardDrive,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFiles } from "../hooks/useApi";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FileManagerProps {
  serverId: string;
}

export function FileManager({ serverId }: FileManagerProps) {
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [currentPath, setCurrentPath] = useState("/var/www");
  const { ls, performAction } = useFiles(serverId);
  const { data: files, isLoading, refetch } = ls(currentPath);

  const handleAction = async (
    action: string,
    path: string,
    destination?: string,
  ) => {
    if (
      action === "rm" &&
      !confirm("Are you sure you want to delete this file/directory?")
    ) {
      return;
    }

    try {
      await performAction({ action, path, destination });
      toast.success(`${action === "mv" ? "Renamed" : "Action"} successful`);
      refetch();
      setRenamingPath(null);
    } catch (error) {
      toast.error(
        `Action failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const startRename = (file: any) => {
    setRenamingPath(file.path);
    setNewName(file.name);
  };

  const submitRename = () => {
    if (!renamingPath || !newName) return;
    const parent = renamingPath.substring(0, renamingPath.lastIndexOf("/"));
    const destination = `${parent}/${newName}`;
    handleAction("mv", renamingPath, destination);
  };

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setRenamingPath(null);
  };

  const goBack = () => {
    if (currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath("/" + parts.join("/"));
  };

  const handleDelete = (path: string) => {
    handleAction("rm", path);
  };

  const breadcrumbs = currentPath.split("/").filter(Boolean);

  return (
    <div className="space-y-4 animate-fade-in h-[calc(100vh-250px)] flex flex-col">
      {/* Utility Bar */}
      <div className="flex items-center justify-between bg-white/[0.03] border border-white/10 p-2 rounded-xl">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            className="h-8 w-8 hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center text-sm text-muted-foreground px-2">
            <span
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => navigateTo("/")}
            >
              /
            </span>
            {breadcrumbs.map((crumb, i) => (
              <div key={i} className="flex items-center">
                <ChevronRight className="w-3 h-3 mx-1 opacity-50" />
                <span
                  className="cursor-pointer hover:text-foreground transition-colors"
                  onClick={() =>
                    navigateTo("/" + breadcrumbs.slice(0, i + 1).join("/"))
                  }
                >
                  {crumb}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="h-8 w-8 hover:bg-white/10"
          >
            <RefreshCcw
              className={cn("w-4 h-4", isLoading && "animate-spin")}
            />
          </Button>
          <Button className="h-8 bg-violet hover:bg-violet-600 text-white text-xs">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New
          </Button>
        </div>
      </div>

      {/* Explorer */}
      <div className="flex-1 bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center px-6 py-3 border-b border-white/10 bg-white/5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          <div className="flex-1">Name</div>
          <div className="w-32">Type</div>
          <div className="w-20 text-right">Actions</div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 text-violet animate-spin" />
              <p className="text-sm text-muted-foreground">
                Reading remote filesystem...
              </p>
            </div>
          ) : files?.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Folder className="w-12 h-12 opacity-10" />
              <p className="text-sm italic">Directory is empty</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {files?.map((file: any) => (
                <div
                  key={file.name}
                  onDoubleClick={() =>
                    file.isDirectory && navigateTo(file.path)
                  }
                  className="flex items-center px-6 py-3 hover:bg-white/5 transition-all group cursor-default select-none transition-colors"
                >
                  <div className="flex-1 flex items-center gap-3">
                    {file.isDirectory ? (
                      <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                    ) : (
                      <File className="w-4 h-4 text-violet" />
                    )}
                    {renamingPath === file.path ? (
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          className="bg-white/10 border border-violet/50 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet w-full"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onBlur={() => setRenamingPath(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitRename();
                            if (e.key === "Escape") setRenamingPath(null);
                          }}
                        />
                      </div>
                    ) : (
                      <span
                        className={cn(
                          "text-sm font-medium transition-colors",
                          file.isDirectory
                            ? "text-foreground group-hover:text-violet"
                            : "text-muted-foreground",
                        )}
                      >
                        {file.name}
                      </span>
                    )}
                  </div>
                  <div className="w-32 text-xs text-muted-foreground opacity-60">
                    {file.isDirectory ? "Folder" : "File"}
                  </div>
                  <div className="w-20 flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-dark/95 backdrop-blur-xl border-white/10"
                      >
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          onClick={() =>
                            file.isDirectory && navigateTo(file.path)
                          }
                        >
                          <ChevronRight className="w-4 h-4" /> Open
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          onClick={() => startRename(file)}
                        >
                          <Edit2 className="w-4 h-4" /> Rename
                        </DropdownMenuItem>
                        {!file.isDirectory && (
                          <DropdownMenuItem className="cursor-pointer gap-2">
                            <Download className="w-4 h-4" /> Download
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(file.path)}
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer / Stats */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest px-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            Total: {files?.length || 0} items
          </span>
          <span className="flex items-center gap-1">
            <Terminal className="w-3 h-3" />
            VPS Terminal Active
          </span>
        </div>
        <span>Double-click to open folders</span>
      </div>
    </div>
  );
}
