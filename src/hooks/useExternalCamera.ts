// src/hooks/useExternalCamera.ts
import { useQuery } from "@tanstack/react-query";
import API, { Camera } from "@/services/api";

export function useExternalCamera() {
  const camerasQuery = useQuery({
    queryKey: ["cameras"],
    queryFn: async (): Promise<Camera[]> => {
      // This calls: GET /ai/cameras?skip=0&limit=100
      return await API.getCameras({ skip: 0, limit: 100 });
    },
    staleTime: 60_000,
  });

  return {
    cameras: camerasQuery.data ?? [],
    isLoading: camerasQuery.isLoading,
    isError: camerasQuery.isError,
    error: camerasQuery.error,
    refetch: camerasQuery.refetch,
  };
}
