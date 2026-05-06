// import { useEffect, useState } from "react";
// // import deepEqual from "deep-equal";
// import { useLocation } from "react-router-dom";

// export function useCustomQuery() {
//   const location = useLocation();

//   const [page, setPage] = useState(
//     () => parseSearchParams(location.search)["page"] || 1
//   );
//   const [sort, setSort] = useState(
//     () => parseSearchParams(location.search)["sort"] || null
//   );
//   const [desc, setDesc] = useState(
//     () => parseSearchParams(location.search)["desc"] || false
//   );
//   const [params, setParams] = useState<{ [key: string]: any }>(() => {
//     const parsed = parseSearchParams(location.search);

//     delete parsed["page"];
//     delete parsed["sort"];
//     delete parsed["desc"];

//     return parsed;
//   });

//   useEffect(() => {
//     const parsed: { [key: string]: any } = parseSearchParams(location.search);

//     setPage(parsed["page"] || 1);
//     setSort(parsed["sort"] || null);
//     setDesc(parsed["desc"] || false);

//     delete parsed["page"];
//     delete parsed["sort"];
//     delete parsed["desc"];

//     if (!deepEqual(params, parsed)) {
//       setParams(parsed);
//     }
//   }, [location.search, params]);

//   return [params, page, sort, desc, setParams];
// }

// export function parseSearchParams(search: string) {
//   const urlSearchParams = new URLSearchParams(search);
//   const parsed: { [key: string]: any } = {};

//   for (const p of urlSearchParams.keys()) {
//     if (!(p in parsed)) {
//       parsed[p] = urlSearchParams.getAll(p);

//       if (parsed[p].length === 1) {
//         parsed[p] = parsed[p][0];
//       }
//     }
//   }

//   return parsed;
// }
