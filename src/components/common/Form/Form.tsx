import { Form as FormComponent, FormProps } from "antd";
import { FC, ReactNode, useEffect } from "react";

interface Props extends FormProps {
  children: ReactNode;
}
export const Form: FC<Props> = ({
  children,
  name,
  labelCol,
  labelWrap = false,
  labelAlign = "left",
  wrapperCol = { flex: 1 },
  colon = false,
  onFinish,
  layout = "vertical",
  initialValues = {},
  ...rest
}) => {
  const [form] = FormComponent.useForm();

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [initialValues]);

  return (
    <FormComponent
      {...rest}
      name={name}
      labelCol={labelCol}
      labelAlign={labelAlign}
      labelWrap={labelWrap}
      form={form}
      wrapperCol={wrapperCol}
      colon={colon}
      onFinish={onFinish}
      layout={layout}
      initialValues={initialValues}
    >
      {children}
    </FormComponent>
  );
};
