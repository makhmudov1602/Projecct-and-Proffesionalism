import React from "react";
import { PageLoadingWrapper } from "./style";
import { Spin } from "antd";

const PageLoading = () => {
  return (
    <PageLoadingWrapper>
      <Spin size="large" />
    </PageLoadingWrapper>
  );
};

export default PageLoading;
