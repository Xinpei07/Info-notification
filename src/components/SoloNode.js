import React, { memo } from 'react';
import './SoloNode.css';

const SoloNode = ({ data }) => {
  return (
    <div>
      {data.label}
    </div>
  );
};

export default memo(SoloNode);
