import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import useChainStore from '../../store/store';

const SunburstChart = ({ data, parallelData }) => {
    const svgRef = useRef(null);
    const { selectedValidators, selectedChain, singleSelectMode } = useChainStore();

    const voteColors = {
        YES: '#2ecc71',
        NO: '#e74c3c',
        NO_WITH_VETO: '#f1c40f',
        ABSTAIN: '#3498db',
        NO_VOTE: '#95a5a6',
    };

    const voteLabels = {
        YES: 'Yes',
        NO: 'No',
        NO_WITH_VETO: 'Veto',
        ABSTAIN: 'Abstain',
        NO_VOTE: 'No Vote',
    };

    const getVoteTypeColor = (voteName) => {
        return voteColors[voteName] || '#95a5a6';
    };

    const checkVoteResult = (proposalId, parallelData, selectedValidators) => {
        if (!selectedValidators || selectedValidators.length === 0) {
            return null;
        }

        const proposalKey = `${selectedChain}_${proposalId}`;

        // 단일 선택 모드
        if (singleSelectMode) {
            if (selectedValidators.length === 1) {
                const validatorData = parallelData.find((d) => d.voter === selectedValidators[0]);
                return validatorData ? validatorData[proposalKey] || 'NO_VOTE' : 'NO_VOTE';
            }
            return null;
        }

        // 다중 선택 모드
        // 단일 검증인이 선택된 경우 null 반환하여 회색으로 표시
        if (selectedValidators.length === 1) {
            return null;
        }

        // 복수 검증인이 선택된 경우 투표 일치 여부 확인
        const validatorVotes = selectedValidators.map((validator) => {
            const validatorData = parallelData.find((d) => d.voter === validator);
            return validatorData ? validatorData[proposalKey] || 'NO_VOTE' : 'NO_VOTE';
        });

        const allSameVote = validatorVotes.every((vote) => vote === validatorVotes[0]);
        return allSameVote ? validatorVotes[0] : false;
    };

    const calculateParticipationRate = (validator) => {
        if (!validator || !data || !parallelData) return 0;

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

    const getValidatorInfo = (validator) => {
        if (!validator || !parallelData) return null;
        const validatorData = parallelData.find((d) => d.voter === validator);
        if (!validatorData) return null;

        return {
            name: validator,
            cluster: validatorData.cluster_label,
            participationRate: calculateParticipationRate(validator).toFixed(1),
        };
    };

    const calculateMatchStatistics = (rawData) => {
        if (!selectedValidators || selectedValidators.length < 2) return { rate: 0, matched: 0, total: 0 };

        const totalProposals = rawData.length;
        const agreedProposals = rawData.filter((d) => {
            const voteResult = checkVoteResult(d.id, parallelData, selectedValidators);
            return typeof voteResult === 'string';
        }).length;

        return {
            rate: ((agreedProposals / totalProposals) * 100).toFixed(1),
            matched: agreedProposals,
            total: totalProposals,
        };
    };

    const transformData = (rawData) => {
        if (!rawData) return null;
        rawData = rawData.sort((a, b) => a.id - b.id);

        const types = new Set(rawData.map((d) => d.type || 'Unknown'));
        const uniqueTypes = Array.from(types);

        const typeCounts = uniqueTypes.map((type) => ({
            type,
            count: rawData.filter((d) => (d.type || 'Unknown') === type).length,
        }));

        const sortedTypes = typeCounts.sort((a, b) => b.count - a.count);
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

        return {
            name: 'Proposals',
            children: sortedTypes.map(({ type }) => ({
                name: type,
                color: colorScale(type),
                children: rawData
                    .filter((d) => (d.type || 'Unknown') === type)
                    .map((d) => ({
                        name: d.title,
                        value: 1,
                        proposalId: d.id,
                        voteResult: checkVoteResult(d.id, parallelData, selectedValidators),
                    })),
            })),
        };
    };

    useEffect(() => {
        if (!data || !parallelData) return;

        const width = 300;
        const height = 290;
        const radius = Math.min(width, height) / 2;
        const legendHeight = 30;

        d3.select(svgRef.current).selectAll('*').remove();

        const svg = d3
            .select(svgRef.current)
            .attr('width', width)
            .attr('height', height + legendHeight);

        const legend = svg.append('g').attr('class', 'legend').attr('transform', `translate(10, 15)`);

        const legendItems = Object.entries(voteLabels);

        let currentX = 0;
        legendItems.forEach(([voteType, label]) => {
            const legendItem = legend.append('g').attr('transform', `translate(${currentX}, 0)`);

            legendItem
                .append('circle')
                .attr('width', 10)
                .attr('height', 10)
                .attr('r', 7)
                .attr('fill', voteColors[voteType])
                .style('opacity', 0.8);

            const legendText = legendItem
                .append('text')
                .attr('x', 14)
                .attr('y', 4)
                .style('font-size', '11px')
                .style('fill', '#666')
                .text(label);

            const textWidth = legendText.node().getComputedTextLength();
            currentX += 14 + textWidth + 15;
        });

        const chartGroup = svg.append('g').attr('transform', `translate(${width / 2}, ${height / 2 + legendHeight})`);

        const hierarchyData = d3.hierarchy(transformData(data)).sum((d) => d.value);
        const partition = d3.partition().size([2 * Math.PI, radius]);
        const root = partition(hierarchyData);

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
            .style('font-size', '12px')
            .style('z-index', '1000');

        const path = chartGroup
            .selectAll('path')
            .data(root.descendants().slice(1))
            .enter()
            .append('path')
            .attr('d', arc)
            .style('fill', (d) => {
                if (d.depth === 2) {
                    // 단일 선택 모드이거나 다중 선택 모드에서 복수 선택된 경우
                    if (singleSelectMode || (!singleSelectMode && selectedValidators.length > 1)) {
                        if (d.data.voteResult === null) {
                            return '#d3d3d3';
                        }
                        return d.data.voteResult ? getVoteTypeColor(d.data.voteResult) : '#d3d3d3';
                    }
                    // 다중 선택 모드에서 단일 선택된 경우
                    return '#d3d3d3';
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
       <strong>Type: ${d.parent.data.name}</strong>
       ${
           (singleSelectMode || (!singleSelectMode && selectedValidators.length > 1)) && d.data.voteResult
               ? `<br/><span style="color: green;">Match Type: ${d.data.voteResult}</span>`
               : ''
       }`;

                tooltip
                    .style('visibility', 'visible')
                    .html(tooltipContent)
                    .style('left', event.pageX + 10 + 'px')
                    .style('top', event.pageY - 10 + 'px');
            })
            .on('mousemove', function (event) {
                tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 10 + 'px');
            })
            .on('mouseout', function (event, d) {
                tooltip.style('visibility', 'hidden');
                d3.select(this)
                    .style('opacity', d.depth === 2 ? 0.8 : 0.6)
                    .style('stroke-width', '0.5');
            });

        const centerGroup = chartGroup
            .append('g')
            .attr('class', 'center-stats')
            .style('opacity', () => {
                if (singleSelectMode) {
                    return selectedValidators.length === 1 ? 1 : 0;
                } else {
                    return selectedValidators.length >= 2 ? 1 : 0;
                }
            });

        if (singleSelectMode && selectedValidators.length === 1) {
            const validatorInfo = getValidatorInfo(selectedValidators[0]);

            const calculateFontSize = (name) => {
                return name.length >= 20 ? '10px' : name.length >= 10 ? '12px' : '14px';
            };

            if (validatorInfo) {
                const splitValidatorName = (name) => {
                    if (name.length <= 15) return { line1: name, line2: null };

                    // Try to split at a space if possible
                    const spaceIndex = name.substring(0, 15).lastIndexOf(' ');

                    if (spaceIndex > 0) {
                        return {
                            line1: name.substring(0, spaceIndex),
                            line2: name.substring(spaceIndex + 1),
                        };
                    }

                    // If no space, split evenly
                    return {
                        line1: name.substring(0, 15),
                        line2: name.substring(15),
                    };
                };

                const { line1, line2 } = splitValidatorName(validatorInfo.name);

                // Dynamically adjust vertical positioning based on two-line or single-line name
                const verticalOffsets = {
                    nameFirstLine: line2 ? -1.2 : -1.2,
                    nameSecondLine: line2 ? 0.2 : 0,
                    cluster: line2 ? 1.2 : 0.2,
                    participation: line2 ? 2.2 : 1.6,
                };

                const fontSize = '12px';

                // First line of validator name
                centerGroup
                    .append('text')
                    .attr('class', 'validator-name-line1')
                    .attr('text-anchor', 'middle')
                    .attr('dy', `${verticalOffsets.nameFirstLine}em`)
                    .style('font-size', calculateFontSize(validatorInfo.name))
                    .style('fill', '#333')
                    .text(line1);

                // Second line of validator name (if exists)
                if (line2) {
                    centerGroup
                        .append('text')
                        .attr('class', 'validator-name-line2')
                        .attr('text-anchor', 'middle')
                        .attr('dy', `${verticalOffsets.nameSecondLine}em`)
                        .style('font-size', calculateFontSize(validatorInfo.name))
                        .style('fill', '#333')
                        .text(line2);
                }

                // Cluster text
                centerGroup
                    .append('text')
                    .attr('class', 'validator-cluster')
                    .attr('text-anchor', 'middle')
                    .attr('dy', `${verticalOffsets.cluster}em`)
                    .style('font-size', '14px')
                    .style('fill', '#666')
                    .text(`Cluster ${validatorInfo.cluster}`);

                // Participation text
                centerGroup
                    .append('text')
                    .attr('class', 'validator-participation')
                    .attr('text-anchor', 'middle')
                    .attr('dy', `${verticalOffsets.participation}em`)
                    .style('font-size', '14px')
                    .style('fill', '#666')
                    .text(`${validatorInfo.participationRate}%`);
            }
        } else if (!singleSelectMode && selectedValidators.length >= 2) {
            const matchStats = calculateMatchStatistics(data);

            centerGroup
                .append('text')
                .attr('class', 'match-rate')
                .attr('text-anchor', 'middle')
                .attr('dy', '-0.2em')
                .style('font-size', '24px')
                .style('fill', '#333')
                .text(`${matchStats.rate}%`);

            centerGroup
                .append('text')
                .attr('class', 'match-count')
                .attr('text-anchor', 'middle')
                .attr('dy', '0.9em')
                .style('font-size', '14px')
                .style('fill', '#666')
                .text(`${matchStats.matched} / ${matchStats.total}`);

            centerGroup
                .append('text')
                .attr('class', 'match-label')
                .attr('text-anchor', 'middle')
                .attr('dy', '2.1em')
                .style('font-size', '14px')
                .style('fill', '#666');
        }
        return () => {
            tooltip.remove();
        };
    }, [data, parallelData, selectedValidators, selectedChain, singleSelectMode]);

    return (
        <div>
            <div className="flex justify-between items-center ">
                <div className="flex items-center gap-4">
                    <p className="pl-3 font-semibold">{singleSelectMode ? 'Personal Votes' : 'Votes Match'}</p>
                </div>
            </div>
            <svg ref={svgRef} className="ml-24" />
        </div>
    );
};

export default SunburstChart;
