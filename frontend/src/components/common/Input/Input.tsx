import React from "react";
import { Input as AntdInput } from "antd";
import { Rule } from "rc-field-form/lib/interface";
import FormItem from "antd/es/form/FormItem";
import { StyledInput, StyledPassword } from "./style";
import { FormMode } from "@/enums/form-mode";
import { formModeType } from "@/types";

const { Password } = AntdInput;

export interface InputProps {
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  type?: string;
  size?: "large" | "middle" | "small";
  value?: string;
  defaultValue?: string;
  maxLength?: number;
  allowClear?: boolean;
  label?: string;
  rules?: Rule[];
  validateTrigger?: string | string[];
  noStyle?: boolean;
  initialValue?: string;
  disabled?: boolean;
  hasFeedback?: boolean;
  dependencies?: any[] | undefined;
  name?: (string | number)[] | string | number;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement> | undefined;
  addonBefore?: any;
  className?: string;
  mode?: formModeType;
  isHidden?: boolean;
}

export const Input = ({
  disabled = false,
  placeholder,
  name,
  required,
  prefix,
  suffix,
  type,
  onChange,
  size = "large",
  value,
  onBlur,
  maxLength = 255,
  allowClear,
  label,
  rules = [],
  validateTrigger,
  noStyle,
  initialValue,
  hasFeedback,
  dependencies,
  onKeyDown,
  addonBefore,
  className = "",
  mode = FormMode.create,
  isHidden = false,
}: InputProps) => {
  const isView = mode === FormMode.view;
  const inputClassName = className.concat(" ", isView ? "view" : "");

  return (
    <FormItem
      initialValue={initialValue}
      label={label}
      name={name}
      rules={[
        ...rules,
        {
          // validator: validateInput,
        },
      ]}
      validateTrigger={validateTrigger}
      noStyle={noStyle}
      hasFeedback={hasFeedback}
      dependencies={dependencies}
      hidden={isHidden}
    >
      {type === "password" ? (
        <StyledPassword
          disabled={isView ? true : disabled}
          placeholder={placeholder}
          required={required}
          prefix={prefix}
          suffix={suffix}
          type={type}
          onChange={onChange}
          size={size}
          value={value}
          onBlur={onBlur}
          maxLength={maxLength}
          allowClear={allowClear}
          className={inputClassName}
        />
      ) : (
        <StyledInput
          disabled={isView ? true : disabled}
          placeholder={placeholder}
          required={required}
          prefix={prefix}
          suffix={suffix}
          type={type}
          onChange={onChange}
          size={size}
          value={value}
          onBlur={onBlur}
          maxLength={maxLength}
          allowClear={allowClear}
          className={inputClassName}
          onKeyDown={onKeyDown}
          addonBefore={addonBefore}
        />
      )}
    </FormItem>
  );
};
