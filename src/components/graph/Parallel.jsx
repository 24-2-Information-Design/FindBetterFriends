import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { NormalColors } from '../color';
import useChainStore from '../../store/store';

const Parallel = ({ data }) => {
    const svgRef = useRef(null);
    const { selectedValidators } = useChainStore();

    // 투표 타입 매핑 객체 추가
    const voteTypeMapping = {
        NO_WITH_VETO: 'VETO',
        NO_VOTE: 'NO VOTE',
    };

    useEffect(() => {
        if (!svgRef.current || !data || data.length === 0) return;

        // SVG 초기화
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = 870;
        const height = 120;
        const spacing = 100;

        svg.attr('width', width).attr('height', height);

        const chainKeys = Object.keys(data[0])
            .filter((key) => {
                if (key === 'voter' || key === 'cluster_label') return false;
                if (key.startsWith('gravity-bridge_')) return true;
                return /^[a-z_]+\d+$/.test(key);
            })
            .sort((a, b) => {
                const numA = parseInt(a.split('_').pop());
                const numB = parseInt(b.split('_').pop());
                return numA - numB;
            });

        const totalWidth = (chainKeys.length + 2) * spacing;
        const minScale = width / totalWidth;
        const colorScale = d3.scaleOrdinal(NormalColors);
        const container = svg.append('g').attr('class', 'container');

        const xScale = d3
            .scalePoint()
            .domain(['Cluster', ...chainKeys, 'End'])
            .range([0, totalWidth])
            .padding(0.5);

        const clusterScale = d3
            .scalePoint()
            .domain([...Array.from({ length: 8 }, (_, i) => `Cluster ${i}`)])
            .range([height, 0])
            .padding(0.5);

        const voteScale = d3
            .scalePoint()
            .domain(['NO VOTE', 'NO', 'VETO', 'ABSTAIN', 'YES']) // 변경된 순서와 레이블
            .range([height, 0])
            .padding(0.5);

        container
            .selectAll('.axis')
            .data(['Cluster', ...chainKeys, 'End'])
            .enter()
            .append('g')
            .attr('class', 'axis')
            .attr('transform', (d) => `translate(${xScale(d)}, 0)`)
            .each(function (d, i) {
                const isCluster = d === 'Cluster' || d === 'End';
                const axis = d3.axisLeft(isCluster ? clusterScale : voteScale);
                d3.select(this).call(axis);
                d3.select(this).selectAll('.tick text').remove();
            });

        const line = d3
            .line()
            .x((d) => xScale(d.chainID))
            .y((d) => {
                if (d.chainID === 'Cluster' || d.chainID === 'End') {
                    return clusterScale(d.vote);
                }
                // 투표 타입 매핑 적용
                const displayVote =
                    d.vote === 'NO_WITH_VETO' ? 'VETO' : d.vote === 'NO_VOTE' ? 'NO VOTE' : d.vote || 'NO VOTE';
                return voteScale(displayVote);
            })
            .defined((d) => d.vote !== undefined);

        container
            .selectAll('.voter-path')
            .data(data)
            .enter()
            .append('path')
            .attr('class', 'voter-path')
            .datum((voter) => ({
                id: voter.voter,
                cluster: voter.cluster_label,
                values: [
                    { chainID: 'Cluster', vote: `Cluster ${voter.cluster_label}` },
                    ...chainKeys.map((chainID) => ({
                        chainID,
                        vote: voter[chainID] || 'NO_VOTE',
                    })),
                    { chainID: 'End', vote: `Cluster ${voter.cluster_label}` },
                ],
            }))
            .attr('fill', 'none')
            .attr('stroke', (d) => colorScale(d.cluster))
            .attr('stroke-width', (d) => (selectedValidators.includes(d.id) ? 2.5 : 1.5))
            .attr('d', (d) => line(d.values))
            .style('opacity', (d) => (selectedValidators.length === 0 || selectedValidators.includes(d.id) ? 0.6 : 0.1))
            .on('mouseover', function (event, d) {
                d3.select(this).attr('stroke-width', 3).style('opacity', 0.9);
            })
            .on('mouseout', function (event, d) {
                d3.select(this)
                    .attr('stroke-width', selectedValidators.includes(d.id) ? 2.5 : 1.5)
                    .style('opacity', selectedValidators.length === 0 || selectedValidators.includes(d.id) ? 0.6 : 0.1);
            });

        const zoom = d3
            .zoom()
            .scaleExtent([minScale, 2])
            .on('zoom', (event) => {
                const transform = event.transform;
                const scale = transform.k;
                const maxX = 0;
                const minX = -totalWidth * scale + width;
                const x = Math.min(maxX, Math.max(minX, transform.x));
                container.attr('transform', `translate(${x},0) scale(${scale},1)`);
            });

        svg.call(zoom).call(zoom.transform, d3.zoomIdentity.scale(minScale));
    }, [data, selectedValidators]);

    // 변경된 투표 타입 레이블
    const voteTypes = ['YES', 'ABSTAIN', 'VETO', 'NO', 'NO VOTE'];

    return (
        <div className="p-3 flex">
            <div className="flex flex-col justify-between py-2 mr-2 font-bold text-xs text-right">
                {voteTypes.map((type) => (
                    <div key={type} className="text-gray-600">
                        {type}
                    </div>
                ))}
            </div>
            <svg ref={svgRef}></svg>
        </div>
    );
};

export default Parallel;
