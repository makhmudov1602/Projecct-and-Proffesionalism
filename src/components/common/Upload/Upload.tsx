import React, { useState } from "react";
import { StarOutlined, UploadOutlined } from "@ant-design/icons";
import {
  Button,
  Form,
  Image,
  Upload as UploadComponent,
  UploadProps,
} from "antd";
import { Rule } from "antd/es/form";
import { formModeType } from "@/types";
import { FormMode } from "@/enums/form-mode";
type fieldType = true | false;
export interface Props {
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
  field?: any;
  className?: string;
  mode?: formModeType;
  textAreaStyle?: React.CSSProperties;
  formItemStyle?: React.CSSProperties;
  list: fieldType;
  filePath?: string;
}

const props = (setSrc: any): UploadProps => {
  return {
    action: "",
    onChange({ file }) {
      if (file.status !== "uploading") {
        setSrc(null);
      }
    },
    multiple: false,
    maxCount: 1,
    showUploadList: {
      extra: ({ size = 0 }) => (
        <span style={{ color: "#cccccc" }}>
          ({(size / 1024 / 1024).toFixed(2)}MB)
        </span>
      ),
      showDownloadIcon: true,
      downloadIcon: "Download",
      showRemoveIcon: true,

      removeIcon: (
        <StarOutlined
          onClick={(e) => console.error(e, "custom removeIcon event")}
        />
      ),
    },
  };
};

const Upload: React.FC<Props> = ({
  initialValue,
  label,
  // inputClass,
  rules = [],
  validateTrigger,
  noStyle,
  formItemStyle,
  list,
  name,
  mode,
  field,
  disabled,
  className = "",
  filePath,
}) => {
  const [src, setSrc] = useState(filePath);
  const itemName = list ? [field.name, name] : name;
  const isView = mode === FormMode.view;
  const inputClassName = className.concat(" ", isView ? "view" : "");

  return (
    <>
      {isView ? null : (
        <Form.Item
          initialValue={initialValue}
          label={label}
          name={itemName}
          rules={[...rules]}
          validateTrigger={validateTrigger}
          noStyle={noStyle}
          style={formItemStyle}
        >
          <UploadComponent
            className={inputClassName}
            {...props(setSrc)}
            name={itemName as string}
            disabled={isView ? true : disabled}
            accept=".jpg, .jpeg, .png"
          >
            <Button icon={<UploadOutlined />}>Upload</Button>
          </UploadComponent>
        </Form.Item>
      )}

      {src && (
        <Image
          width={200}
          src={src}
          style={{ marginTop: "15px", marginBottom: "15px" }}
        />
      )}
    </>
  );
};
export default Upload;
