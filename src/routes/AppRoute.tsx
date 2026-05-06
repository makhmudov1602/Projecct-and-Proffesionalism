import React from "react";
import { privateRoutes, publicRoutes } from "./routes";
import NotFound from "./components/NotFound";
import { Route, Routes } from "react-router-dom";
import PublicRoute from "./components/PublicRoute";
import PrivateRoute from "./components/PrivateRoute";

const AppRoute = () => {
  return (
    <Routes>
      {publicRoutes.map((el) => (
        <React.Fragment key={el.path}>
          <Route
            path={el.path}
            element={
              <PublicRoute>
                <el.element />
              </PublicRoute>
            }
          />
        </React.Fragment>
      ))}

      {privateRoutes.map((el) => (
        <React.Fragment key={el.path}>
          <Route
            path={el.path}
            element={
              <PrivateRoute>
                <el.element />
              </PrivateRoute>
            }
          />
        </React.Fragment>
      ))}

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoute;
