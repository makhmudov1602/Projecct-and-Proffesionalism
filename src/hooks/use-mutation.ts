import { useMutation } from "@tanstack/react-query";
export const retryMutate = (mutate: any, data: any) => {
  return {
    onError: (_error: any) => {
      mutate(data);
    },
  };
};
interface Params {
  mutationFn: (data: any) => Promise<any>;
  refetch?: any;
}

export const useCustomMutation = ({ mutationFn, refetch }: Params) => {
  const { data, mutate, isPending, error, isError, isSuccess, reset } =
    useMutation({
      mutationFn: async (data?: any) => await mutationFn(data),
      onSuccess: () => {
        if (refetch) {
          refetch();
        }
      },
      onError: (error) => {
        console.error(error);
      },
    });

  return {
    submitData: data,
    mutate,
    isPending,
    error,
    isError,
    isSuccess,
    reset,
  };
};
