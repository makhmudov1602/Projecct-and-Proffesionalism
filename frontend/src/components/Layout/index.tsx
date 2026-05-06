import { FC, ReactNode, useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";
// import Breadcrumb from "../Breadcrumb";
import styles from "./Layout.module.scss";

interface Props {
  children: ReactNode;
}

const LayoutInner: FC<Props> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className={styles.layout}>
      {!isMobile && <Sidebar />}
      <div className={styles.main} data-mobile={isMobile}>
        <Header />
        <div className={styles.content}>
          {/* <Breadcrumb /> */}
          <div className={styles.childrenWrapper}>{children}</div>
        </div>
        <Footer />
      </div>
    </div>
  );
};

const Layout: FC<Props> = ({ children }) => (
  <LayoutInner>{children}</LayoutInner>
);

export default Layout;
