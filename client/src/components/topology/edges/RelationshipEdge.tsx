import React, { useState, useCallback, memo } from 'react';
import { BaseEdge, getBezierPath, EdgeLabelRenderer, type EdgeProps, useViewport } from '@xyflow/react';

function RelationshipEdgeInner(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style } = props;
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const [hovered, setHovered] = useState(false);
  const { zoom } = useViewport();

  const showLabel = data?.label && (zoom >= 0.6 || hovered);

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  return (
    <>
      {/* Invisible wide path for hover detection */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'default' }}
      />
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="absolute text-[10px] bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 pointer-events-none"
          >
            {data.label as React.ReactNode}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const RelationshipEdge = memo(RelationshipEdgeInner);
export default RelationshipEdge;
