import React from 'react';
import { niceMax, barRatio } from '../utils/chartMath';

const TOP = 14;
const BOTTOM = 30;

// Vertical bar chart drawn in SVG. Bars grow with a CSS transform, so they animate
// smoothly whenever the data changes (for example after a refresh).
export function BarChart({
  items,
  labelKey,
  valueKey,
  secondaryKey,
  format,
  labelFormat = (value) => value,
  labelEvery = 1,
  height = 200,
  width = 600,
  ariaLabel
}) {
  const WIDTH = width;
  const plotHeight = height - TOP - BOTTOM;
  const slot = WIDTH / Math.max(items.length, 1);
  const values = items.map((item) => Math.max(0, Number(item[valueKey]) || 0));
  const max = niceMax(Math.max(0, ...values));
  const hasData = values.some((value) => value > 0);
  const transition = 'transform 500ms cubic-bezier(0.2, 0.7, 0.2, 1)';

  return (
    <svg className="svg-chart" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={ariaLabel}>
      {[0, 0.5, 1].map((step) => (
        <line
          key={step}
          className="svg-grid"
          x1="0"
          x2={WIDTH}
          y1={TOP + plotHeight * (1 - step)}
          y2={TOP + plotHeight * (1 - step)}
        />
      ))}
      <text className="svg-label" x="4" y={TOP - 3}>{format(max)}</text>

      {items.map((item, index) => {
        const value = values[index];
        const label = labelFormat(item[labelKey]);
        const x = index * slot;
        const barWidth = slot * 0.6;
        const secondaryValue = secondaryKey ? Math.max(0, Number(item[secondaryKey]) || 0) : null;
        return (
          <g key={`${item[labelKey]}-${index}`}>
            <title>
              {secondaryKey
                ? `${label}: ${format(value)} sales, ${format(secondaryValue)} profit`
                : `${label}: ${format(value)}`}
            </title>
            <rect
              className="svg-bar-primary"
              x={x + slot * 0.2}
              y={TOP}
              width={barWidth}
              height={plotHeight}
              style={{ transform: `scaleY(${barRatio(value, max)})`, transformOrigin: 'center bottom', transformBox: 'fill-box', transition }}
            />
            {secondaryKey && (
              <rect
                className="svg-bar-secondary"
                x={x + slot * 0.32}
                y={TOP}
                width={barWidth * 0.56}
                height={plotHeight}
                style={{ transform: `scaleY(${barRatio(secondaryValue, max)})`, transformOrigin: 'center bottom', transformBox: 'fill-box', transition }}
              />
            )}
            {index % labelEvery === 0 && (
              <text className="svg-label" x={x + slot / 2} y={height - 8} textAnchor="middle">{label}</text>
            )}
          </g>
        );
      })}

      {!hasData && (
        <text className="svg-empty" x={WIDTH / 2} y={TOP + plotHeight / 2} textAnchor="middle">No sales in this period</text>
      )}
    </svg>
  );
}
