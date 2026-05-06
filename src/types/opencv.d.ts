// types/opencv.d.ts
declare module "opencv.js" {
  interface Mat {
    delete(): void;
    cols: number;
    rows: number;
  }

  interface Size {
    width: number;
    height: number;
  }

  interface Point {
    x: number;
    y: number;
  }

  interface Moments {
    m00: number;
    m10: number;
    m01: number;
  }

  interface VideoCapture {
    read(mat: Mat): void;
  }

  const CV_8UC1: number;
  const CV_8UC4: number;
  const CV_8U: number;
  const COLOR_RGBA2GRAY: number;
  const THRESH_BINARY: number;
  const BORDER_DEFAULT: number;

  function cvtColor(src: Mat, dst: Mat, code: number): void;
  function GaussianBlur(src: Mat, dst: Mat, ksize: Size, sigmaX: number, sigmaY: number, borderType: number): void;
  function absdiff(src1: Mat, src2: Mat, dst: Mat): void;
  function threshold(src: Mat, dst: Mat, thresh: number, maxval: number, type: number): void;
  function dilate(src: Mat, dst: Mat, kernel: Mat, anchor: Point, iterations: number): void;
  function countNonZero(src: Mat): number;
  function moments(src: Mat, binaryImage: boolean): Moments;

  class Mat {
    constructor(rows: number, cols: number, type: number);
    static ones(rows: number, cols: number, type: number): Mat;
  }

  const cv: {
    Mat: typeof Mat;
    VideoCapture: new (element: HTMLVideoElement) => VideoCapture;
    Size: new (width: number, height: number) => Size;
    Point: new (x: number, y: number) => Point;
    ready: boolean;
    onRuntimeInitialized: () => void;
    // Add other OpenCV functions/constants you use
  };

  export = cv;
}