import React, { useState } from "react";
import { Form, Checkbox as AntdCheckbox } from "antd";
import { Rule } from "rc-field-form/lib/interface";
import { CheckboxChangeEvent } from "antd/es/checkbox";
import { formModeType } from "@/types";
import { FormMode } from "@/enums/form-mode";

export interface CheckboxProps {
  onChange?: ((e: boolean) => void) | undefined;
  onBlur?: ((event: React.FocusEvent<HTMLInputElement>) => void) | undefined;
  label?: string;
  name?: (string | number)[] | string | number;
  className?: string;
  rules?: Rule[];
  noStyle?: boolean;
  initialValue?: boolean;
  disabled?: boolean;
  checked?: boolean | undefined;
  mode?: formModeType;
}

export const Checkbox = ({
  disabled = false,
  label,
  name,
  onChange,
  rules,
  className,
  noStyle,
  // initialValue,
  checked,
  mode,
}: CheckboxProps) => {
  const [isChecked, setIsChecked] = useState(checked);
  const customDisabled = mode === FormMode.view || disabled ? true : false;

  const handleChange = (e: CheckboxChangeEvent) => {
    if (onChange) {
      onChange(e.target.checked);
      setIsChecked(e.target.checked);
    }
  };

  return (
    <Form.Item
      name={name}
      valuePropName="checked"
      rules={rules}
      className={className}
      noStyle={noStyle}
      initialValue={checked}
    >
      <AntdCheckbox
        disabled={customDisabled}
        onChange={handleChange}
        checked={checked}
      >
        {label}
      </AntdCheckbox>
    </Form.Item>
  );
};
