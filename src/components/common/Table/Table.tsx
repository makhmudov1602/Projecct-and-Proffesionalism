// import React, { useEffect, useState } from "react";
// import { ColumnsType, TableLocale } from "antd/lib/table/interface";
// import { Table as AntdTable, Button } from "antd";
// import {
//   FilterValue,
//   Key,
//   SortOrder,
//   TablePaginationConfig,
//   TableRowSelection,
// } from "antd/es/table/interface";
// import { useQuery } from "@tanstack/react-query";
// import { Link, useLocation, useSearchParams } from "react-router-dom";
// import styled from "styled-components";
// import { useTranslation } from "react-i18next";
// import { useCustomNavigate } from "@/hooks/use-custom-navigate";
// import { useCustomQuery } from "@/hooks/use-query";

// type TypeType = "page" | "prev" | "next" | "jump-prev" | "jump-next";

// export type TableFilterType = {
//   pageIndex: number;
//   pageSize: number;
//   options?: any[];
//   sortBy?: string;
//   orderBy?: string;
//   dateFrom?: string;
//   dateTo?: string;
//   email?: string;
//   modules?: string;
// };

// export interface TableProps {
//   request: {
//     queryKey: string;
//     queryFn: (a: any) => Promise<any>;
//   };
//   locale?: TableLocale;
//   loading?: boolean;
//   rowKey?: string;
//   saveData?: any;
//   columns: ColumnsType<any>;
//   dataSource?: object[];
//   size?: "small" | "large" | "middle";
//   rowClassName?: string;
//   onRow?: any;
//   onChange?: any;
//   disablePagination?: boolean;
//   components?: any;
//   scroll?: any;
//   linkProps?: {
//     url: string;
//     recordKey?: string;
//   };
//   url?: string;
//   filter?: TableFilterType;
//   defaultSort?: string;
//   enableSelectedRow?: boolean;
//   reload?: number;
//   setSelectedRows?: any;
//   setSelectedKeys?: any;
//   rowSelectionFunction?: TableRowSelection<any>;
//   pagination?: TablePaginationConfig;
//   createUrl?: string;
//   refetchData?: string | null;
//   customParams?: any;
//   isSuccess?: any;
// }

// interface EditableCellProps {
//   title: React.ReactNode;
//   editable: boolean;
//   children: React.ReactNode;
//   dataIndex?: string;
//   record: any;
//   className: string;
//   colSpan?: number;
// }

// interface SorterResult {
//   order?: SortOrder;
//   field?: string;
//   columnKey?: Key;
// }

// export const Table = ({
//   request,
//   locale,
//   loading,
//   // rowKey = "id",
//   columns,
//   dataSource,
//   size,
//   rowClassName,
//   onRow,
//   onChange,
//   disablePagination,
//   components,
//   scroll = { x: "max-content" },
//   linkProps,
//   // url,
//   // filter,
//   defaultSort = "",
//   enableSelectedRow,
//   // reload,
//   setSelectedRows,
//   setSelectedKeys,
//   rowSelectionFunction,
//   createUrl,
//   refetchData,
//   customParams = {},
//   isSuccess,
// }: TableProps) => {
//   const [searchParams, setSearchParams] = useSearchParams();
//   const [innerData, setInnerData] = useState<any>(dataSource || []);
//   const [currentPage, setCurrentPage] = useState<any>(
//     searchParams.has("pi") ? searchParams.get("pi") : 1
//   );
//   const [pageSize, setPageSize] = useState(10);
//   const [sortBy, setSortBy] = useState<string | undefined>(defaultSort);
//   const [orderBy, setOrderBy] = useState<string>("desc");
//   const [localPagination, setLocalPagination] = useState<any>({
//     showSizeChanger: false,
//     showQuickJumper: false,
//   });

//   useEffect(() => {
//     setInnerData(dataSource);
//   }, [dataSource]);
//   const { t } = useTranslation();
//   const { isLoading, refetch } = useQuery({
//     queryKey: Object.values(customParams).length
//       ? [request.queryKey, ...Object.values(customParams)]
//       : [request.queryKey],
//     queryFn: async () =>
//       await request
//         .queryFn({
//           pi: currentPage,
//           ps: pageSize,
//           s: "",
//           ot: orderBy,
//           ...customParams,
//         })
//         .then((res) => {
//           setInnerData(res.items);
//           setPageSize(res.pageSize);
//           setLocalPagination({
//             ...localPagination,
//             current: res.pageIndex,
//             total: res.totalItems,
//           });
//         }),
//     staleTime: 0,
//   });

//   useEffect(() => {
//     refetch();
//   }, [sortBy, currentPage, orderBy, refetchData]); // eslint-disable-line react-hooks/exhaustive-deps

//   useEffect(() => {
//     if (Object.values(customParams).length) {
//       refetch();
//     }
//   }, [...Object.values(customParams)]);

//   useEffect(() => {
//     if (isSuccess) {
//       refetch();
//     }
//   }, [isSuccess]);

//   const element = document.getElementsByClassName(
//     "anticon anticon-down ant-select-suffix"
//   );

//   element[0]?.classList?.add("far");
//   element[0]?.classList?.add("fa-angle-down");
//   element[0]?.classList?.remove("anticon");
//   element[0]?.classList?.remove("anticon-down");
//   element[0]?.classList?.remove("ant-select-suffix");

//   const EditableCell: React.FC<EditableCellProps> = ({
//     record,
//     children,
//     className,
//     ...rest
//   }) => {
//     // actions dont have link
//     if (rest.dataIndex === "id" || rest.dataIndex === undefined) {
//       return (
//         <td className={className} colSpan={rest.colSpan}>
//           {children}
//         </td>
//       );
//     }

//     let parsedProps = {
//       url: linkProps?.url,
//       recordKey: linkProps?.recordKey,
//     };

//     //default key is id
//     if (!parsedProps?.recordKey) {
//       parsedProps.recordKey = "id";
//     }

//     // for data not found
//     if (rest.colSpan) {
//       parsedProps.url = undefined;
//     }

//     if (!linkProps?.url) {
//       return (
//         <td className={className} colSpan={rest.colSpan}>
//           {children}
//         </td>
//       );
//     }

//     return (
//       <td className={className + " history-clickable"} colSpan={rest.colSpan}>
//         <Link
//           to={linkProps.url.replace(
//             ":id",
//             record?.[parsedProps.recordKey] || "undefined"
//           )}
//         >
//           {children}
//         </Link>
//       </td>
//     );
//   };

//   const parsedColumns = columns.map((col: any) => {
//     if (components) {
//       return { ...col };
//     }

//     return {
//       ...col,
//       onCell: (record: object) => ({
//         record,
//         dataIndex: col.dataIndex,
//         title: col.title,
//       }),
//     };
//   });

//   const onTableChange = async (
//     { pageSize }: TablePaginationConfig,
//     _filters: Record<string, FilterValue | null>,
//     { field, order }: SorterResult
//   ) => {
//     setPageSize(pageSize || 10);

//     if (order) {
//       setOrderBy(order === "descend" ? "desc" : "asc");
//     }

//     setSortBy(field);
//   };

//   const rowSelection = {
//     onChange: (selectedRowKeys: React.Key[], selectedRows: object) => {
//       setSelectedRows && setSelectedRows(selectedRows);
//       setSelectedKeys && setSelectedKeys(selectedRowKeys);
//     },
//   };

//   return (
//     <>
//       {createUrl && (
//         <CustomLink type="primary" htmlType="button">
//           <Link to={createUrl}>{t("Buttons.create")}</Link>
//         </CustomLink>
//       )}
//       <AntdTable
//         locale={locale}
//         loading={isLoading || loading}
//         // rowKey={rowKey}
//         columns={parsedColumns}
//         dataSource={innerData}
//         size={size}
//         pagination={
//           !disablePagination &&
//           localPagination.total > 10 && {
//             ...localPagination,
//             current: currentPage,
//             onChange(pageIdx, _pageSize) {
//               setSearchParams({
//                 ...Object.fromEntries(searchParams),
//                 pi: String(pageIdx),
//               });
//               setCurrentPage(() => pageIdx);
//             },
//           }
//         }
//         rowClassName={rowClassName}
//         onRow={onRow}
//         onChange={onChange || onTableChange}
//         components={{
//           body: {
//             cell: EditableCell,
//           },
//           ...components,
//         }}
//         showSorterTooltip={false}
//         scroll={scroll}
//         rowSelection={
//           enableSelectedRow ? rowSelectionFunction ?? rowSelection : undefined
//         }
//       />
//     </>
//   );
// };

// const CustomLink = styled(Button)`
//   display: flex;
//   justify-content: end;
//   width: max-content;
//   margin-left: auto;
//   margin-bottom: 20px;
// `;
