import { Input as AntdInput } from "antd";
import styled from "styled-components";
import { Input } from "antd";

export const StyledPassword = styled(Input.Password)`
  input::placeholder {
    color: #fff;
  }

  .ant-input-suffix {
    svg {
      fill: #fff;
      stroke: #fff;
    }
  }
`;

export const StyledInput = styled(AntdInput)`
  &.view {
    border: none;
    border-bottom: 1px solid black;
    border-radius: 0;

    &.ant-input-disabled {
      background-color: transparent;
      color: black;
    }
  }

  &.ant-input-affix-wrapper {
    &:hover {
      border: var(--primary-color) 1px solid;
      background: var(--white-smoke);
    }
    &:focus {
      border: none;
      background: none;
      outline: none;
      box-shadow: none;
    }
    &.ant-input-outlined:focus-within {
      border: var(--primary-color) 1px solid;
      background: none;
      outline: none;
      box-shadow: none;
    }
    .ant-input-suffix {
      padding-right: 5px;
    }
  }
`;
