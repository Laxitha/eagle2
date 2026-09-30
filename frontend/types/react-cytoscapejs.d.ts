declare module "react-cytoscapejs" {
  import { Core, ElementDefinition, LayoutOptions, StylesheetStyle } from "cytoscape";
  import { CSSProperties, Component } from "react";

  interface CytoscapeComponentProps {
    elements: ElementDefinition[];
    style?: CSSProperties;
    stylesheet?: StylesheetStyle[];
    layout?: LayoutOptions;
    cy?: (cy: Core) => void;
    [key: string]: unknown;
  }

  export default class CytoscapeComponent extends Component<CytoscapeComponentProps> {}
}
