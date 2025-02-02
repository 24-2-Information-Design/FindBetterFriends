import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { NormalColors } from '../color';
import useChainStore from '../../store/store';

const Parallel = ({ data }) => {
    const svgRef = useRef(null);
    const { selectedValidators, hiddenValidators } = useChainStore();

    const voteTypeMapping = {
        NO_WITH_VETO: 'VETO',
        NO_VOTE: 'NO VOTE',
    };

    useEffect(() => {
        if (!svgRef.current || !data || data.length === 0 || selectedValidators.length === 0) return;

        // SVG 초기화
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = 870;
        const height = 120;
        const spacing = 100;

        svg.attr('width', width).attr('height', height);

        // 선택된 검증인들 중 hidden이 아닌 데이터만 필터링
        const selectedData = data.filter(
            (validator) => selectedValidators.includes(validator.voter) && !hiddenValidators.has(validator.voter)
        );

        // hidden이 아닌 선택된 검증인이 없는 경우 처리
        if (selectedData.length === 0) {
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .text('표시할 검증인이 없습니다.');
            return;
        }

        // 체인 키 추출
        const chainKeys = Object.keys(selectedData[0])
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

        // 불일치하는 투표가 있는 체인만 필터링
        const divergentChains = chainKeys.filter((chain) => {
            const votes = new Set(selectedData.map((validator) => validator[chain]));
            return votes.size > 1; // 서로 다른 투표가 존재하는 경우만
        });

        // 불일치하는 체인이 없으면 메시지 표시
        if (divergentChains.length === 0) {
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .text('모든 선택된 검증인의 투표가 일치합니다.');
            return;
        }

        const totalWidth = (divergentChains.length + 2) * spacing;
        const minScale = width / totalWidth;
        const colorScale = d3.scaleOrdinal(NormalColors);
        const container = svg.append('g').attr('class', 'container');

        const xScale = d3
            .scalePoint()
            .domain(['Cluster', ...divergentChains, 'End'])
            .range([0, totalWidth])
            .padding(0.5);

        const clusterScale = d3
            .scalePoint()
            .domain([...Array.from({ length: 8 }, (_, i) => `Cluster ${i}`)])
            .range([height, 0])
            .padding(0.5);

        const voteScale = d3
            .scalePoint()
            .domain(['NO VOTE', 'NO', 'VETO', 'ABSTAIN', 'YES'])
            .range([height, 0])
            .padding(0.5);

        // 축 그리기
        container
            .selectAll('.axis')
            .data(['Cluster', ...divergentChains, 'End'])
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
                const displayVote =
                    d.vote === 'NO_WITH_VETO' ? 'VETO' : d.vote === 'NO_VOTE' ? 'NO VOTE' : d.vote || 'NO VOTE';
                return voteScale(displayVote);
            })
            .defined((d) => d.vote !== undefined);

        // 경로 그리기
        container
            .selectAll('.voter-path')
            .data(selectedData)
            .enter()
            .append('path')
            .attr('class', 'voter-path')
            .datum((voter) => ({
                id: voter.voter,
                cluster: voter.cluster_label,
                values: [
                    { chainID: 'Cluster', vote: `Cluster ${voter.cluster_label}` },
                    ...divergentChains.map((chainID) => ({
                        chainID,
                        vote: voter[chainID] || 'NO_VOTE',
                    })),
                    { chainID: 'End', vote: `Cluster ${voter.cluster_label}` },
                ],
            }))
            .attr('fill', 'none')
            .attr('stroke', (d) => colorScale(d.cluster))
            .attr('stroke-width', 2.5)
            .attr('d', (d) => line(d.values))
            .style('opacity', 0.6)
            .on('mouseover', function (event, d) {
                d3.select(this).attr('stroke-width', 3).style('opacity', 0.9);
            })
            .on('mouseout', function (event, d) {
                d3.select(this).attr('stroke-width', 2.5).style('opacity', 0.6);
            });

        // 줌 기능
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
    }, [data, selectedValidators, hiddenValidators]);

    const voteTypes = ['YES', 'ABSTAIN', 'VETO', 'NO', 'NOVOTE'];

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
