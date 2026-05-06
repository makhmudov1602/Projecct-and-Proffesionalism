import React from "react";
import { DatePicker as AntdDatePicker } from "antd";
import { Rule } from "rc-field-form/lib/interface";
import FormItem from "antd/es/form/FormItem";
import { FormMode } from "@/enums/form-mode";

export interface DatePickerProps {
  onChange?: (date: any, dateString: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  size?: "large" | "middle" | "small";
  value?: any;
  format?: string;
  rules?: Rule[];
  className?: string;
  validateTrigger?: string | string[];
  noStyle?: boolean;
  initialValue?: any;
  disabled?: boolean;
  hasFeedback?: boolean;
  dependencies?: any[] | undefined;
  name?: (string | number)[] | string | number;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement> | undefined;
  picker?: "date" | "week" | "month" | "quarter" | "year";
  showTime?: boolean;
  mode?: string;
  disabledDate?: any;
}

export const DatePicker = ({
  disabled = false,
  placeholder,
  name,
  required,
  size,
  value,
  format = "DD-MM-YY",
  onBlur,
  rules = [],
  className,
  validateTrigger,
  noStyle,
  initialValue,
  hasFeedback,
  dependencies,
  picker = "date",
  showTime = false,
  mode,
  disabledDate = false,
}: DatePickerProps) => {
  const isView = (mode as string) === FormMode.view;

  return (
    <FormItem
      initialValue={initialValue}
      name={name}
      rules={rules}
      validateTrigger={validateTrigger}
      noStyle={noStyle}
      hasFeedback={hasFeedback}
      dependencies={dependencies}
    >
      <AntdDatePicker
        disabled={isView ? true : disabled}
        placeholder={placeholder}
        required={required}
        size={size}
        value={value}
        format={format}
        onBlur={onBlur}
        className={className}
        picker={picker}
        showTime={showTime}
        disabledDate={disabledDate}
      />
    </FormItem>
  );
};
