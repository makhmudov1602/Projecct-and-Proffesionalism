import { FC, ReactNode } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { routes } from "../../../constants/routes";
import { AuthState } from "@/interfaces";

interface IPublicRoute {
  children: ReactNode;
}

const PublicRoute: FC<IPublicRoute> = ({ children }) => {
  const auth: AuthState = useSelector((state: any) => state.auth);
  const user: AuthState = useSelector((state: any) => state.userData.user);

  if (auth.isLogged && auth.token && !!user) {
    return <Navigate to={routes.HOME} replace />;
  }

  return children;
};

export default PublicRoute;
