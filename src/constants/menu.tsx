import { ReactNode } from "react";
import { ImTarget } from "react-icons/im";

export interface Item {
  name: string;
  path: string;
  icon?: ReactNode;
}

export interface MenuItem extends Item {
  children?: MenuItem[];
}

export const menuItems: MenuItem[] = [
  {
    name: "Boshlash",
    path: "/start",
    icon: <ImTarget />,
  },
];
