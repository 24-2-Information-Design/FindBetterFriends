import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { NormalColors } from '../color';
import useChainStore from '../../store/store';

const ScatterPlot = ({ data }) => {
    const svgRef = useRef(null);
    const {
        selectedValidators,
        setSelectedValidators,
        baseValidator,
        setBaseValidator,
        singleSelectMode,
        setSingleSelectMode,
        resetValidatorSelection,
    } = useChainStore();

    useEffect(() => {
        if (!data || data.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = 500;
        const height = 350;
        const margin = { top: 0, right: 50, bottom: 60, left: 50 };

        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        svg.attr('width', width).attr('height', height);

        const chart = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

        const maxNodeSize = 10;
        const minNodeSize = 1;

        const xExtent = d3.extent(data, (d) => d.tsne_x);
        const yExtent = d3.extent(data, (d) => d.tsne_y);

        const padding = maxNodeSize;
        const xPadding = (xExtent[1] - xExtent[0]) * 0.05;
        const yPadding = (yExtent[1] - yExtent[0]) * 0.05;

        const xScale = d3
            .scaleLinear()
            .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
            .range([padding, chartWidth - padding]);

        const yScale = d3
            .scaleLinear()
            .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
            .range([chartHeight - padding, padding]);

        // participation_rate를 기준으로 노드 크기 조정
        const sizeScale = d3
            .scaleSqrt()
            .domain([0, d3.max(data, (d) => d.participation_rate)])
            .range([minNodeSize, maxNodeSize]);

        // 클러스터 라벨의 고유한 값을 정렬된 숫자로 변환
        const uniqueClusters = Array.from(new Set(data.map((d) => Number(d.cluster_label)))).sort((a, b) => a - b);

        // 색상 스케일을 정확한 인덱스로 매핑
        const colorScale = d3
            .scaleOrdinal()
            .domain(uniqueClusters)
            .range(uniqueClusters.map((cluster) => NormalColors[cluster]));

        const sortedData = [...data].sort((a, b) => sizeScale(b.participation_rate) - sizeScale(a.participation_rate));

        chart
            .append('g')
            .attr('transform', `translate(0, ${chartHeight})`)
            .call(d3.axisBottom(xScale).ticks(10))
            .attr('font-size', '12px');

        chart.append('g').call(d3.axisLeft(yScale).ticks(10)).attr('font-size', '12px');

        const tooltip = d3
            .select('body')
            .append('div')
            .append('circle')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background', 'rgba(0, 0, 0, 0.7)')
            .style('color', '#fff')
            .style('padding', '5px 10px')
            .style('border-radius', '5px')
            .style('font-size', '12px')
            .style('pointer-events', 'none');

        function handleNodeClick(event, d) {
            event.stopPropagation();
            if (singleSelectMode) {
                const isCurrentlySelected = selectedValidators.includes(d.voter);
                if (isCurrentlySelected) {
                    setSelectedValidators([]);
                    setBaseValidator(null);
                } else {
                    setSelectedValidators([d.voter]);
                    setBaseValidator(d.voter);
                }
            } else {
                const isSelected = selectedValidators.includes(d.voter);
                let newSelected;
                if (isSelected) {
                    newSelected = selectedValidators.filter((v) => v !== d.voter);
                    if (d.voter === baseValidator) {
                        setBaseValidator(newSelected.length > 0 ? newSelected[0] : null);
                    }
                } else {
                    newSelected = [...selectedValidators, d.voter];
                    if (!baseValidator) {
                        setBaseValidator(d.voter);
                    }
                }
                setSelectedValidators(newSelected);
            }
        }

        const brush = d3
            .brush()
            .extent([
                [0, 0],
                [chartWidth, chartHeight],
            ])
            .on('end', (event) => {
                if (!event.selection || singleSelectMode) return;

                const [[x0, y0], [x1, y1]] = event.selection;
                const selectedNodes = data.filter(
                    (d) =>
                        xScale(d.tsne_x) >= x0 &&
                        xScale(d.tsne_x) <= x1 &&
                        yScale(d.tsne_y) >= y0 &&
                        yScale(d.tsne_y) <= y1
                );

                if (selectedNodes.length > 0) {
                    const newSelected = [...selectedValidators, ...selectedNodes.map((d) => d.voter)];
                    const uniqueSelected = [...new Set(newSelected)];
                    setSelectedValidators(uniqueSelected);
                    if (!baseValidator && uniqueSelected.length > 0) {
                        setBaseValidator(uniqueSelected[0]);
                    }
                }

                chart.select('.brush').call(brush.move, null);
            });

        const brushContainer = chart.append('g').attr('class', 'brush');

        if (!singleSelectMode) {
            brushContainer.call(brush);
        }

        const minClickRadius = Math.max(minNodeSize, 5);

        const nodes = chart
            .selectAll('circle')
            .data(sortedData)
            .enter()
            .append('circle')
            .attr('cx', (d) => xScale(d.tsne_x))
            .attr('cy', (d) => yScale(d.tsne_y))
            .attr('r', (d) => {
                const nodeRadius = sizeScale(d.participation_rate);
                return Math.max(nodeRadius, minClickRadius);
            })
            .attr('fill', (d) => colorScale(d.cluster_label))
            .attr('opacity', (d) => (selectedValidators.includes(d.voter) ? 1 : 0.6))
            .attr('stroke', (d) => {
                if (d.voter === baseValidator) return '#000';
                return selectedValidators.includes(d.voter) ? '#666' : 'none';
            })
            .attr('stroke-width', (d) => (d.voter === baseValidator ? 2 : 1))
            .style('cursor', 'pointer')
            .on('click', handleNodeClick)
            .on('mouseover', (event, d) => {
                tooltip
                    .style('visibility', 'visible')
                    .html(
                        `<strong>${d.voter}</strong><br/>
                        Participation Rate: ${(d.participation_rate * 100).toFixed(2)}%<br/>
                        Cluster: ${d.cluster_label}`
                    )
                    .style('left', `${event.pageX + 10}px`)
                    .style('top', `${event.pageY}px`);
            })
            .on('mousemove', (event) => {
                tooltip.style('left', `${event.pageX + 10}px`).style('top', `${event.pageY}px`);
            })
            .on('mouseout', () => {
                tooltip.style('visibility', 'hidden');
            });

        return () => {
            tooltip.remove();
        };
    }, [data, selectedValidators, baseValidator, singleSelectMode]);

    const handleReset = () => {
        resetValidatorSelection();
    };

    return (
        <div>
            <div className="flex items-center gap-4 pl-3">
                <p className="font-semibold">Validator Votes Similarity</p>
                <div className="flex items-center gap-4">
                    <label className="flex items-center space-x-2 text-sm">
                        <input
                            type="checkbox"
                            checked={singleSelectMode}
                            onChange={(e) => setSingleSelectMode(e.target.checked)}
                            className="form-checkbox h-4 w-4"
                        />
                        <span>Single Selection</span>
                    </label>
                    <button onClick={handleReset} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">
                        Reset
                    </button>
                </div>
            </div>
            <svg ref={svgRef}></svg>
        </div>
    );
};

export default ScatterPlot;
