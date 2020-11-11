import React, {memo, useMemo} from 'react';
import {useStoreState} from "react-flow-renderer";
import {BACKGROUND_HEIGHT_PADDING, SUBJECT_Y_COORD_SPACING} from "./GraphConstants";

const DEBUG_OUTPUT = false;

const defaultColor = '#dbdbdb';

const createDividersPath = (dividerPositions, bgColor, width) => {
  const data = dividerPositions.map(x => "M0," + x + " h5").join("\n");
  // if (DEBUG_OUTPUT) console.log("[createDividersPath] data: '" + data + "'");
  return `<path stroke="${bgColor}" stroke-width="${width}" d="${data}" />`;
}

const getHorizontalDividerPositions = (nodeMaxCoords, y, scale) => {
  // if (DEBUG_OUTPUT) console.log("[getHorizontalDividerPositions] nodeMaxCoords: ", nodeMaxCoords);
  let lineYPositions = [];
  for (let i = 1; i < nodeMaxCoords.length; i++) {
    const maxCoords = nodeMaxCoords[i].coords;
    const basePosition = maxCoords.yStart - (SUBJECT_Y_COORD_SPACING / 2);
    const position = (basePosition * scale) + y;
    // if (DEBUG_OUTPUT) console.log("[getHorizontalDividerPositions] basePos: ", basePosition, " pos: ", position);
    lineYPositions.push(position);
  }
  // if (DEBUG_OUTPUT) console.log("[getHorizontalDividerPositions] lineYPositions", lineYPositions);
  return lineYPositions;
}

const getGraphTotalHeight = (nodeMaxCoords) => {
  if (nodeMaxCoords.length === 0) {
    return 0;
  }
  const coords = nodeMaxCoords[nodeMaxCoords.length - 1].coords;
  return coords.yStart + coords.yTotal;
}

const CustomBackground = ({
                      size = 1,
                      color,
                      style,
                      className,
                      nodeMaxCoords
                    }) => {
  const [x, y, scale] = useStoreState((s) => s.transform);
  // if (DEBUG_OUTPUT) console.log("[Background] x: ", x, ", y: ", y, ", scale: ", scale);

  const bgClasses = 'react-flow__background' + ( className !== undefined ? " " + className : "" );

  const bgSvgTile = useMemo(() => {
    const bgColor = color ? color : defaultColor;
    const dividerPositions = getHorizontalDividerPositions(nodeMaxCoords, y, scale);
    const path = createDividersPath(dividerPositions, bgColor, size);
    // if (DEBUG_OUTPUT) console.log("[CustomBackground] Path: ", path);

    const svgHeight = getGraphTotalHeight(nodeMaxCoords) + (2 * BACKGROUND_HEIGHT_PADDING);
    // if (DEBUG_OUTPUT) console.log("[Background] svgHeight: ", svgHeight);

    return encodeURIComponent(
      `<svg width="1" xmlns='http://www.w3.org/2000/svg'>${path}</svg>`
    );
  }, [color, size, scale, y, nodeMaxCoords]);

  return (
    <div
      className={bgClasses}
      style={{
        ...style,
        backgroundImage: `url("data:image/svg+xml;utf8,${bgSvgTile}")`,
      }}
    />
  );
};

export default memo(CustomBackground);
