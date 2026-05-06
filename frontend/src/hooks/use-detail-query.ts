import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

interface Params {
  mutationFn: (data: any) => Promise<any>;
}

export const useDetailData = ({ mutationFn }: Params) => {
  const { id } = useParams();
  const [submitData, setSubmitData] = useState<any>(null);

  const { data, isPending, error, isError, isSuccess, refetch } = useQuery({
    queryKey: ["data", id],
    queryFn: async () => await mutationFn(id),
  });

  useEffect(() => {
    refetch();
  }, [id]);

  useEffect(() => {
    if (isSuccess && data) {
      setSubmitData(data);
    }
  }, [isSuccess, data]);

  return {
    submitData,
    mutate: (_a: any) => {},
    isPending,
    error,
    isError,
    isSuccess,
    refetch,
  };
};
