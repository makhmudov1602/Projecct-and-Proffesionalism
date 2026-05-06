import React from "react";
import { Form, Input } from "antd";
import { Rule } from "rc-field-form/lib/interface";
import styles from "./Textarea.module.css";
import { FormMode } from "@/enums/form-mode";
import { formModeType } from "@/types";
type fieldType = true | false;

export interface TextAreaProps {
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  size?: "large" | "middle" | "small";
  value?: string;
  defaultValue?: string;
  maxLength?: number;
  allowClear?: boolean;
  label?: string | React.ReactNode;
  rules?: Rule[];
  name?: (string | number)[] | string | number;
  validateTrigger?: string | string[];
  noStyle?: boolean;
  initialValue?: string;
  disabled?: boolean;
  rows?: number;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement> | undefined;
  inputClass?: string;
  list: fieldType;
  field?: any;
  className?: string;
  mode?: formModeType;
  textAreaStyle?: React.CSSProperties;
  formItemStyle?: React.CSSProperties;
}

export const Textarea = ({
  disabled = false,
  placeholder,
  name,
  required,
  onChange,
  size = "large",
  value,
  onBlur,
  defaultValue,
  allowClear,
  label,
  rules = [],
  validateTrigger,
  noStyle,
  initialValue,
  rows = 4,
  onKeyDown,
  list = false,
  field,
  className = "",
  mode = FormMode.create,
  textAreaStyle,
  formItemStyle,
}: TextAreaProps) => {
  const itemName = list ? [field.name, name] : name;
  const isView = mode === FormMode.view;
  const inputClassName = className.concat(" ", isView ? "view" : "");

  return (
    <Form.Item
      initialValue={initialValue}
      label={label}
      name={itemName}
      rules={[...rules]}
      className={styles.form__item}
      validateTrigger={validateTrigger}
      noStyle={noStyle}
      style={formItemStyle}
    >
      <Input.TextArea
        disabled={isView ? true : disabled}
        placeholder={placeholder}
        required={required}
        size={size}
        onChange={onChange}
        value={value}
        onBlur={onBlur}
        defaultValue={defaultValue}
        allowClear={allowClear}
        rows={rows}
        onKeyDown={onKeyDown}
        className={`${styles.textarea} ${inputClassName} `}
        style={textAreaStyle}
      />
    </Form.Item>
  );
};
