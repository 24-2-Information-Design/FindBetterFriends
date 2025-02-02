import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import useChainStore from '../../store/store';

const IndividualSunburst = ({ data, parallelData, validator, width, height }) => {
    const svgRef = useRef(null);
    const { selectedChain, isValidatorHidden } = useChainStore();

    const getVoteTypeColor = (voteName) => {
        const voteColors = {
            YES: '#2ecc71',
            NO: '#e74c3c',
            NO_WITH_VETO: '#f1c40f',
            ABSTAIN: '#3498db',
            NO_VOTE: '#95a5a6',
        };
        return voteColors[voteName] || '#95a5a6';
    };

    const calculateParticipationRate = () => {
        if (!validator || !data || !parallelData || isValidatorHidden(validator)) return 0;

        const validatorData = parallelData.find((d) => d.voter === validator);
        if (!validatorData) return 0;

        const totalProposals = data.length;
        const participatedProposals = data.reduce((count, proposal) => {
            const proposalKey = `${selectedChain}_${proposal.id}`;
            const vote = validatorData[proposalKey];
            return vote && vote !== 'NO_VOTE' ? count + 1 : count;
        }, 0);

        return (participatedProposals / totalProposals) * 100;
    };

    const calculateFontSize = (name) => {
        return name.length >= 20 ? '8px' : name.length >= 10 ? '10px' : '12px';
    };

    const splitValidatorName = (name) => {
        if (name.length <= 15) return { line1: name, line2: null };

        const spaceIndex = name.substring(0, 15).lastIndexOf(' ');

        if (spaceIndex > 0) {
            return {
                line1: name.substring(0, spaceIndex),
                line2: name.substring(spaceIndex + 1),
            };
        }

        return {
            line1: name.substring(0, 15),
            line2: name.substring(15),
        };
    };

    useEffect(() => {
        if (!data || !parallelData || isValidatorHidden(validator)) return;

        const radius = Math.min(width, height) / 2;

        d3.select(svgRef.current).selectAll('*').remove();

        const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);

        const chartGroup = svg.append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);

        // Get unique types and create color scale
        const types = new Set(data.map((d) => d.type || 'Unknown'));
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

        // Transform data for individual validator
        const transformedData = {
            name: 'Proposals',
            children: Array.from(types).map((type) => ({
                name: type,
                color: colorScale(type),
                children: data
                    .filter((d) => (d.type || 'Unknown') === type)
                    .map((d) => {
                        const proposalKey = `${selectedChain}_${d.id}`;
                        const validatorData = parallelData.find((pd) => pd.voter === validator);
                        const vote = validatorData ? validatorData[proposalKey] || 'NO_VOTE' : 'NO_VOTE';
                        return {
                            name: d.title,
                            value: 1,
                            proposalId: d.id,
                            voteResult: vote,
                        };
                    }),
            })),
        };

        const hierarchyData = d3.hierarchy(transformedData).sum((d) => d.value);
        const partition = d3.partition().size([2 * Math.PI, radius]);
        const root = partition(hierarchyData);

        // Set custom radius for smaller chart
        root.descendants().forEach((d) => {
            if (d.depth === 1) {
                d.y0 = radius * 0.4;
                d.y1 = radius * 0.7;
            } else if (d.depth === 2) {
                d.y0 = radius * 0.7;
                d.y1 = radius * 0.95;
            }
        });

        const arc = d3
            .arc()
            .startAngle((d) => d.x0)
            .endAngle((d) => d.x1)
            .innerRadius((d) => d.y0)
            .outerRadius((d) => d.y1);

        const tooltip = d3
            .select('body')
            .append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background-color', 'white')
            .style('border', '1px solid #ddd')
            .style('padding', '10px')
            .style('border-radius', '4px')
            .style('font-size', '8px')
            .style('z-index', '1000');

        // Draw paths
        chartGroup
            .selectAll('path')
            .data(root.descendants().slice(1))
            .enter()
            .append('path')
            .attr('d', arc)
            .style('fill', (d) => {
                if (d.depth === 2) {
                    return d.data.voteResult ? getVoteTypeColor(d.data.voteResult) : '#d3d3d3';
                }
                return d.data.color;
            })
            .style('opacity', (d) => (d.depth === 2 ? 0.8 : 0.6))
            .style('stroke', 'white')
            .style('stroke-width', '0.5')
            .on('mouseover', function (event, d) {
                d3.select(this).style('opacity', 1).style('stroke-width', '2');

                const tooltipContent =
                    d.depth === 1
                        ? `<strong>Type: ${d.data.name}</strong><br/>
                       <span>Number of Proposals: ${d.children.length}</span>`
                        : `<strong>Proposal ID: ${d.data.proposalId}</strong><br/>
                       <strong>Proposal: ${d.data.name}</strong><br/>
                       <strong>Type: ${d.parent.data.name}</strong><br/>
                       <span>Vote: ${d.data.voteResult}</span>`;

                tooltip
                    .style('visibility', 'visible')
                    .html(tooltipContent)
                    .style('left', event.pageX + 10 + 'px')
                    .style('top', event.pageY - 10 + 'px');
            })
            .on('mousemove', function (event) {
                tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 10 + 'px');
            })
            .on('mouseout', function () {
                tooltip.style('visibility', 'hidden');
                d3.select(this)
                    .style('opacity', (d) => (d.depth === 2 ? 0.8 : 0.6))
                    .style('stroke-width', '0.5');
            });

        const participationRate = calculateParticipationRate().toFixed(1);
        const validatorData = parallelData.find((d) => d.voter === validator);
        const clusterLabel = validatorData ? validatorData.cluster_label : 'N/A';
        const { line1, line2 } = splitValidatorName(validator);
        const verticalOffsets = {
            nameFirstLine: line2 ? -1.2 : -1.2,
            nameSecondLine: line2 ? 0.2 : 0,
            cluster: line2 ? 1.2 : 0.2,
            participation: line2 ? 2.2 : 1.6,
        };
        chartGroup
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', `${verticalOffsets.nameFirstLine}em`)
            .style('font-size', calculateFontSize(validator))
            .style('fill', '#333')
            .text(line1);

        // Second line of validator name (if exists)
        if (line2) {
            chartGroup
                .append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', `${verticalOffsets.nameSecondLine}em`)
                .style('font-size', calculateFontSize(validator))
                .style('fill', '#333')
                .text(line2);
        }

        // Cluster label
        chartGroup
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', `${verticalOffsets.cluster}em`)
            .style('font-size', '12px')
            .style('fill', '#666')
            .text(`Cluster ${clusterLabel}`);

        // Participation rate
        chartGroup
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', `${verticalOffsets.participation}em`)
            .style('font-size', '8px')
            .style('fill', '#666')
            .text(`${participationRate}%`);

        return () => {
            tooltip.remove();
        };
    }, [data, parallelData, validator, width, height, selectedChain]);

    return <svg ref={svgRef} />;
};

export default IndividualSunburst;
