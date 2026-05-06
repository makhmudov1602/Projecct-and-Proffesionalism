declare module "react-highlight-words" {
  import * as React from "react";

  export interface HighlighterProps {
    highlightClassName?: string;
    searchWords: string[];
    autoEscape?: boolean;
    textToHighlight: string;
    highlightStyle?: React.CSSProperties;
    sanitize?: (text: string) => string;
    caseSensitive?: boolean;
  }

  export default class Highlighter extends React.Component<HighlighterProps> {}
}
