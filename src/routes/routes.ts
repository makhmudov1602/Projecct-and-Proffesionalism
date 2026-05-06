import { routes } from "@/constants/routes";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Start from "@/pages/start";

export const publicRoutes = [
  {
    path: routes.LOGIN,
    element: Login,
  },
];

export const privateRoutes = [
  {
    path: routes.HOME,
    element: Home,
  },


  {
    path: routes.START,
    element: Start,
  },

 
];
