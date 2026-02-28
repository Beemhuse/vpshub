import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";

export const useAuth = () => {
  const { setAuth, logout: storeLogout } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: async (credentials: any) => {
      const { data } = await api.post("/auth/login", credentials);
      return data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.access_token);
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (userData: any) => {
      const { data } = await api.post("/auth/signup", userData);
      return data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.access_token);
    },
  });

  const logout = () => {
    storeLogout();
  };

  return {
    login: loginMutation.mutateAsync,
    signup: signupMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isSigningUp: signupMutation.isPending,
    logout,
  };
};

export const useDashboard = () => {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data } = await api.get("/dashboard/stats");
      return data;
    },
  });
};

export const useActivities = () => {
  return useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data } = await api.get("/dashboard/activity");
      return data;
    },
  });
};

export const useServers = () => {
  return useQuery({
    queryKey: ["servers"],
    queryFn: async () => {
      const { data } = await api.get("/servers");
      return data;
    },
  });
};

export const useServer = (id: string) => {
  return useQuery({
    queryKey: ["servers", id],
    queryFn: async () => {
      const { data } = await api.get(`/servers/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useServerMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (serverData: any) => {
      const { data } = await api.post("/servers", serverData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: response } = await api.patch(`/servers/${id}`, data);
      return response;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      queryClient.invalidateQueries({ queryKey: ["servers", id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/servers/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const { data } = await api.post(`/servers/${id}/actions`, { action });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });

  return {
    createServer: createMutation.mutateAsync,
    updateServer: updateMutation.mutateAsync,
    deleteServer: deleteMutation.mutateAsync,
    performAction: actionMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isPerformingAction: actionMutation.isPending,
  };
};

export const useServerConnect = () => {
  const queryClient = useQueryClient();

  const connectMutation = useMutation({
    mutationFn: async (connectData: any) => {
      const { data } = await api.post("/servers/connect", connectData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });

  return {
    connectServer: connectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
  };
};

export const useServerStats = (serverId: string) => {
  return useQuery({
    queryKey: ["servers", serverId, "stats"],
    queryFn: async () => {
      const { data } = await api.get(`/servers/${serverId}/stats`);
      return data;
    },
    enabled: !!serverId,
    refetchInterval: 5000, // Poll every 5 seconds
  });
};

export const useTerminalCommand = (serverId: string) => {
  const mutation = useMutation({
    mutationFn: async (command: string) => {
      const { data } = await api.post(`/servers/${serverId}/terminal`, {
        command,
      });
      return data;
    },
  });

  return {
    executeCommand: mutation.mutateAsync,
    isExecuting: mutation.isPending,
  };
};

export const useTemplates = () => {
  return useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data } = await api.get("/templates");
      return data;
    },
  });
};

export const useDeployments = (serverId?: string) => {
  return useQuery({
    queryKey: ["deployments", serverId],
    queryFn: async () => {
      const { data } = await api.get("/deployments", {
        params: { serverId },
      });
      return data;
    },
  });
};

export const useProjects = (serverId?: string) => {
  return useQuery({
    queryKey: ["projects", serverId],
    queryFn: async () => {
      const { data } = await api.get("/projects", {
        params: { serverId },
      });
      return data;
    },
  });
};

export const useProject = (id: string) => {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useProjectMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (projectData: any) => {
      const { data } = await api.post("/projects", projectData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: response } = await api.patch(`/projects/${id}`, data);
      return response;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/projects/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return {
    createProject: createMutation.mutateAsync,
    updateProject: updateMutation.mutateAsync,
    deleteProject: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

export const useDeployment = (id: string) => {
  return useQuery({
    queryKey: ["deployments", id],
    queryFn: async () => {
      const { data } = await api.get(`/deployments/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useDeploymentMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (deploymentData: any) => {
      const { data } = await api.post("/deployments", deploymentData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/deployments/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });

  return {
    createDeployment: createMutation.mutateAsync,
    deleteDeployment: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

export const useBilling = () => {
  const invoices = useQuery({
    queryKey: ["billing-invoices"],
    queryFn: async () => {
      const { data } = await api.get("/billing/invoices");
      return data;
    },
  });

  const usage = useQuery({
    queryKey: ["billing-usage"],
    queryFn: async () => {
      const { data } = await api.get("/billing/usage");
      return data;
    },
  });

  return {
    invoices: invoices.data,
    usage: usage.data,
    isLoading: invoices.isLoading || usage.isLoading,
  };
};

export const useLogs = (serverId?: string) => {
  return useQuery({
    queryKey: ["logs", serverId],
    queryFn: async () => {
      const { data } = await api.get("/logs", {
        params: { serverId },
      });
      return data;
    },
  });
};
export const useDocker = (serverId: string) => {
  const queryClient = useQueryClient();

  const containersQuery = useQuery({
    queryKey: ["servers", serverId, "docker"],
    queryFn: async () => {
      const { data } = await api.get(`/servers/${serverId}/docker`);
      return data;
    },
    enabled: !!serverId,
    refetchInterval: 10000, // Poll every 10 seconds
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      containerId,
      action,
    }: {
      containerId: string;
      action: string;
    }) => {
      const { data } = await api.post(
        `/servers/${serverId}/docker/${containerId}/${action}`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["servers", serverId, "docker"],
      });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });

  return {
    containers: containersQuery.data,
    isLoading: containersQuery.isLoading,
    performAction: actionMutation.mutateAsync,
    isPerformingAction: actionMutation.isPending,
  };
};

export const useFiles = (serverId: string) => {
  const queryClient = useQueryClient();

  const lsQuery = (path: string) =>
    useQuery({
      queryKey: ["servers", serverId, "files", path],
      queryFn: async () => {
        const { data } = await api.post("/files/ls", { serverId, path });
        return data;
      },
      enabled: !!serverId && !!path,
    });

  const actionMutation = useMutation({
    mutationFn: async (dto: any) => {
      const { data } = await api.post("/files/action", { ...dto, serverId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["servers", serverId, "files"],
      });
    },
  });

  return {
    ls: lsQuery,
    performAction: actionMutation.mutateAsync,
    isPerformingAction: actionMutation.isPending,
  };
};
