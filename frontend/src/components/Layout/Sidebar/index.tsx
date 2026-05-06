import styles from "./Sidebar.module.scss";
import logo from "@/assets/img/university-mark.svg";
import { useState } from "react";
import { BsChevronRight } from "react-icons/bs";
import { menuItems } from "@/constants/menu";
import { useLocation, useNavigate } from "react-router-dom";

const Sidebar = () => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubClick = (path: string) => {
    navigate(path);
    setOpenMenu(null);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.inner}>
        <button className={styles.sidebarHeader} onClick={() => navigate("/")}>
          <img src={logo} alt="Universitet logotipi" className={styles.logo} />
          <div className={styles.brandText}>
            <strong>Nishon Arena</strong>
            <span>Live competition panel</span>
          </div>
        </button>

        <div className={styles.statusCard}>
          <span className={styles.statusDot} />
          <div>
            <strong>Platforma rejimi</strong>
            <p>Archery & Rifle Arena</p>
          </div>
        </div>

        <nav className={styles.menuContainer}>
          {menuItems.map((item) => {
            const hasChildren = Array.isArray(item.children) && item.children.length > 0;
            const isOpen = openMenu === item.name;
            const isActive =
              location.pathname === item.path ||
              Boolean(item.children?.some((child) => child.path === location.pathname));

            return (
              <div key={item.name} className={styles.menuItem}>
                <button
                  className={`${styles.menuTitle} ${isActive ? styles.active : ""}`}
                  onClick={() => {
                    if (hasChildren) {
                      setOpenMenu(isOpen ? null : item.name);
                    } else {
                      handleSubClick(item.path);
                    }
                  }}
                >
                  <span className={styles.icon}>
                    {item.icon}
                    <span>{item.name}</span>
                  </span>
                  <span className={`${styles.chevron} ${isOpen ? styles.open : ""}`}>
                    <BsChevronRight />
                  </span>
                </button>

                {hasChildren && (
                  <div className={`${styles.subMenu} ${isOpen ? styles.openMenu : ""}`}>
                    {item.children!.map((sub) => (
                      <button
                        key={sub.name}
                        className={`${styles.subMenuItem} ${location.pathname === sub.path ? styles.subActive : ""}`}
                        onClick={() => handleSubClick(sub.path)}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
