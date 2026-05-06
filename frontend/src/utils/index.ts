import { message } from "antd";
import { AxiosResponse } from "axios";

export const filterOption = (
  input: string,
  option?: { label: string; value: string }
) =>
  (option?.label.toLocaleLowerCase() ?? "").includes(input.toLocaleLowerCase());

export const formattedDate = (value: string) => {
  if (value) {
    const d = new Date(value);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear().toString();
    const date = `${day}.${month}.${year}`;

    return date; //04.03.2025
  }
  return "";
};

export const changeError = (error: any): any => {
  const status = error?.response?.status ?? 500;
  const message = error?.message ?? "An error occurred";

  return {
    status,
    message,
  };
};

export function setCookie(cname: string, cvalue: string, time: Date) {
  let expires = "expires=" + time.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

export function removeCookieItem(key: string) {
  const currentTime = new Date();
  const newTime = new Date(currentTime.getTime() - 3600);

  setCookie(key, "", newTime);
}

export function getCookie(cname: string) {
  if (typeof window === "object") {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == " ") {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
  }
  return "";
}

export const encryptedData = (value: string) => {
  if (value) {
    return btoa(value);
  }
  return "";
};

export const decryptedData = (key: string) => {
  if (key) {
    return atob(key);
  }
  return "";
};

export const blobDataToFile = async ({
  axiosQuery,
  setPdf,
  setLoading,
}: {
  axiosQuery: Promise<AxiosResponse<any, any>>;
  setPdf: any;
  setLoading?: any;
}) => {
  await axiosQuery
    .then((res) => {
      const file = new File([res.data], "pdf", { type: res.data.type });
      readFile(file);

      function readFile(file: any) {
        const rf = new FileReader();

        rf.readAsDataURL(file);

        rf.addEventListener("load", () => {
          const res = rf.result;
          setPdf(res);
        });
      }
    })
    .catch((err) => {
      message.error("Apida xatolik yuz berdi");
      console.error("Error", err.message);
    })
    .finally(() => {
      setLoading(false);
    });
};

export const changeText = (text: string, searchValue: string) => {
  const formatText = text ? text : "";
  return `<span>${formatText
    .toLowerCase()
    .replace(
      searchValue,
      `<span style="color:#ADFF00;">${searchValue}</span>`
    )}</span>`;
};
// localStorageHelper.ts

type StorageValue = string | number | boolean | object | null;

export const localStorageHelper = {
  setItem: (key: string, value: StorageValue): void => {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  },

  getItem: <T>(key: string): T | null => {
    if (typeof window !== "undefined") {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : null;
    }
    return null;
  },

  removeItem: (key: string): void => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(key);
    }
  },

  clear: (): void => {
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  },
};

export default localStorageHelper;

export const transformTextUpper = (text: string) => text.toUpperCase();

export function route(route: string, params: any = {}): string {
  let builtRoute = route;

  Object.keys(params).forEach((property) => {
    builtRoute = builtRoute.replace(`:${property}`, params[property]);
  });

  return builtRoute;
}
