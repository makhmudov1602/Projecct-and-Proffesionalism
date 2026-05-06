// import React, { useRef, useState } from "react";
// import { SearchOutlined } from "@ant-design/icons";
// import type { InputRef, TableColumnType } from "antd";
// import { Button, DatePicker, Input, Space } from "antd";
// import type { FilterDropdownProps } from "antd/es/table/interface";
// import Highlighter from "react-highlight-words";
// import { Select } from "@/components/common/Select";
// import { tableSearchInputKey } from "@/enums/table-search-input-key";
// import dayjs from "dayjs";

// type DataIndex<T> = keyof T;

// export const useTableSearch = <T extends object>() => {
//   const [searchText, setSearchText] = useState("");
//   const [searchedColumn, setSearchedColumn] = useState<DataIndex<T> | "">("");
//   const searchInput = useRef<InputRef>(null);

//   const handleSearch = (
//     selectedKeys: string[],
//     confirm: FilterDropdownProps["confirm"],
//     dataIndex: DataIndex<T>
//   ) => {
//     confirm();
//     setSearchText(selectedKeys[0]);
//     setSearchedColumn(dataIndex);
//   };

//   const handleReset = (clearFilters: () => void) => {
//     clearFilters();
//     setSearchText("");
//   };

//   const getColumnSearchProps = (
//     dataIndex: DataIndex<T>,
//     inputKey: "input" | "select" | "date",
//     request?: {
//       queryKey: string;
//       queryFn: (a: any) => Promise<any>;
//     }
//   ): TableColumnType<T> => ({
//     filterDropdown: ({
//       setSelectedKeys,
//       selectedKeys,
//       confirm,
//       clearFilters,
//       close,
//     }) => (
//       <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
//         {inputKey === tableSearchInputKey.input && (
//           <Input
//             ref={searchInput}
//             placeholder={`Search ${String(dataIndex)}`}
//             value={selectedKeys[0]}
//             onChange={(e) =>
//               setSelectedKeys(e.target.value ? [e.target.value] : [])
//             }
//             onPressEnter={() =>
//               handleSearch(selectedKeys as string[], confirm, dataIndex)
//             }
//             style={{ marginBottom: 8, display: "block" }}
//           />
//         )}
//         {inputKey === tableSearchInputKey.select && (
//           <Select
//             list={false}
//             request={request}
//             showSearch
//             value={selectedKeys[0] as string}
//             onChange={(e: any) => setSelectedKeys(e ? [e] : [])}
//             style={{ marginBottom: 8, display: "block" }}
//             placeholder="Search to Select"
//             filterSort={(optionA: any, optionB: any) =>
//               (optionA?.label ?? "")
//                 .toLowerCase()
//                 .localeCompare((optionB?.label ?? "").toLowerCase())
//             }
//           />
//         )}

//         {inputKey === tableSearchInputKey.date && (
//           <DatePicker
//             // value={selectedKeys[0] as string}
//             style={{ display: "block", marginBottom: "8px" }}
//             onChange={(e: any) => {
//               setSelectedKeys(
//                 e
//                   ? [
//                       JSON.stringify(
//                         dayjs(e).format("YYYY-MM-DDTHH:mm:ss.SSS") + "+5"
//                       ),
//                     ]
//                   : []
//               );
//             }}
//             placeholder="Search to Select"
//           />
//         )}
//         <Space>
//           <Button
//             type="primary"
//             onClick={() =>
//               handleSearch(selectedKeys as string[], confirm, dataIndex)
//             }
//             icon={<SearchOutlined />}
//             size="small"
//             style={{ width: 90 }}
//           >
//             Search
//           </Button>
//           <Button
//             onClick={() => clearFilters && handleReset(clearFilters)}
//             size="small"
//             style={{ width: 90 }}
//           >
//             Reset
//           </Button>
//           <Button
//             type="link"
//             size="small"
//             onClick={() => {
//               close();
//             }}
//           >
//             Close
//           </Button>
//         </Space>
//       </div>
//     ),
//     filterIcon: (filtered: boolean) => (
//       <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
//     ),
//     onFilterDropdownOpenChange: (visible) => {
//       if (visible) {
//         setTimeout(() => searchInput.current?.select(), 100);
//       }
//     },
//     render: (text) =>
//       searchedColumn === dataIndex ? (
//         <Highlighter
//           highlightStyle={{ backgroundColor: "#ffc069", padding: 0 }}
//           searchWords={[searchText]}
//           autoEscape
//           textToHighlight={text ? text.toString() : ""}
//         />
//       ) : (
//         text
//       ),
//   });

//   return { getColumnSearchProps, searchText, searchedColumn };
// };
