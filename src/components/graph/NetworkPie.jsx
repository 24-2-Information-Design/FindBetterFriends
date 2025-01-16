import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import jsonData from '../../data/chain_data.json';
import linkData from '../../data/chain_link_data.json';
import { NormalColors, clusterNames, clusterArr } from '../color';
import useChainStore from '../../store/store';

const NetworkPie = () => {
    const svgRef = useRef(null);
    const { setSelectedChain, selectedValidators, highlightedChains, selectedChain, getChainOpacity } = useChainStore();
    const [activeClusters, setActiveClusters] = useState(new Set(clusterArr));

    const toggleCluster = (cluster) => {
        const newActiveClusters = new Set(activeClusters);
        if (newActiveClusters.has(cluster)) {
            newActiveClusters.delete(cluster);
        } else {
            newActiveClusters.add(cluster);
        }
        setActiveClusters(newActiveClusters);
    };

    const getOpacityForSlice = (clusterIndex) => {
        // 군집이 선택되지 않은 경우 모든 섹션의 opacity는 1
        if (activeClusters.size === 0) return 1;
        // 활성화된 군집만 opacity를 유지하고 나머지는 낮춤
        return activeClusters.has(clusterIndex) ? 1 : 0.2;
    };

    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = 620;
        const height = 370;
        const padding = 60; // 여백

        // Zoom 설정
        const zoomableGroup = svg.append('g').attr('class', 'zoomable-group');

        const zoom = d3
            .zoom()
            .scaleExtent([0.5, 5])
            .translateExtent([
                [0, 0],
                [width, height],
            ])
            .on('zoom', (event) => {
                zoomableGroup.attr('transform', event.transform);
            });

        svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).call(zoom);

        const initialScale = 0.8;
        const initialTranslate = [width * 0.1, height * 0.1];
        svg.call(zoom.transform, d3.zoomIdentity.translate(...initialTranslate).scale(initialScale));

        // 차트 크기 설정
        const maxRadius = Math.min(width, height) / 8; // 차트 크기 축소
        const chartRadius = maxRadius;
        const arcMinRadius = 8;
        const arcPadding = 1;
        const numArcs = Object.keys(jsonData[0].proposal).length;
        const arcWidth = (chartRadius - arcMinRadius - numArcs * arcPadding) / (numArcs * 5);

        // 노드 데이터 생성
        const nodes = jsonData.map((chainData) => {
            // x-axis, y-axis 값을 스케일링하여 사용
            const xScale = d3
                .scaleLinear()
                .domain(d3.extent(jsonData, (d) => d['x-axis']))
                .range([padding + chartRadius + 20, width - (padding + chartRadius + 20)]);

            const yScale = d3
                .scaleLinear()
                .domain(d3.extent(jsonData, (d) => d['y-axis']))
                .range([padding + chartRadius + 20, height - (padding + chartRadius + 20)]);

            return {
                id: chainData.chain,
                radius: chainData.radius,
                proposal: chainData.proposal,
                proportion: chainData.proportion,
                // 스케일링된 x, y 좌표 사용
                x: xScale(chainData['x-axis']),
                y: yScale(chainData['y-axis']),
                // 위치를 약간 조정할 수 있도록 fx, fy는 설정하지 않음
            };
        });

        // Force simulation 설정 수정
        const forceSimulation = d3
            .forceSimulation(nodes)
            .force('charge', d3.forceManyBody().strength(-100))
            .force(
                'collision',
                d3
                    .forceCollide()
                    .radius((d) => {
                        const baseRadius = Math.min(8 + d.radius, maxRadius);
                        return baseRadius + chartRadius + 20;
                    })
                    .strength(1)
            ) // 충돌 강도를 1로 설정하여 확실히 겹치지 않도록 함
            .force('x', d3.forceX((d) => d.x).strength(0.5)) // 원래 x 위치로 돌아가려는 힘
            .force('y', d3.forceY((d) => d.y).strength(0.5)) // 원래 y 위치로 돌아가려는 힘
            // 경계 검사 force 추가
            .force('bounds', () => {
                nodes.forEach((node) => {
                    const r = Math.min(8 + node.radius, maxRadius) + chartRadius + 20;
                    // 경계를 벗어나지 않도록 조정
                    node.x = Math.max(r, Math.min(width - r, node.x));
                    node.y = Math.max(r, Math.min(height - r, node.y));
                });
            });

        // Force simulation 반복 횟수 증가
        for (let i = 0; i < 500; i++) forceSimulation.tick();

        // 노드 매핑
        const nodeById = {};
        nodes.forEach((node) => {
            nodeById[node.id] = node;
        });

        // 링크 렌더링
        linkData.forEach((link) => {
            const sourceNode = nodeById[link.chain1];
            const targetNode = nodeById[link.chain2];

            if (sourceNode && targetNode) {
                const lineThickness = Math.sqrt(link.shared_validators);
                zoomableGroup
                    .append('line')
                    .attr('x1', sourceNode.x)
                    .attr('y1', sourceNode.y)
                    .attr('x2', targetNode.x)
                    .attr('y2', targetNode.y)
                    .attr('stroke', '#dbe6f1')
                    .attr('stroke-width', Math.max(lineThickness, 1))
                    .attr('opacity', link.shared_validators >= 40 ? 0.6 : 0.3)
                    .attr('class', `link-line link-${link.chain1} link-${link.chain2}`)
                    // 선택된 체인이 없으면 모든 링크 표시, 있으면 해당 체인과 연결된 링크만 표시
                    .style(
                        'visibility',
                        selectedChain
                            ? link.chain1 === selectedChain || link.chain2 === selectedChain
                                ? 'visible'
                                : 'hidden'
                            : 'visible'
                    )
                    .append('title')
                    .text(`${link.chain1} ↔ ${link.chain2}: ${link.shared_validators} shared validators`);
            }
        });
        // 차트 색상 스케일
        const colorScale = d3.scaleOrdinal(NormalColors);

        const getInnerRadius = (index) => arcMinRadius + index * (arcWidth + arcPadding);
        const getOuterRadius = (index) => getInnerRadius(index) + arcWidth;

        // 파이 차트 및 바 차트 렌더링
        nodes.forEach((node) => {
            const chainData = jsonData.find((chain) => chain.chain === node.id);
            const radius = Math.min(8 + chainData.radius, maxRadius);

            const proportionData = Object.entries(chainData.proportion).map(([key, value]) => ({ month: key, value }));

            // 파이 차트 생성
            const pie = d3.pie().value((d) => d.value);
            const arcData = pie(proportionData);
            const pieArc = d3.arc().innerRadius(0).outerRadius(radius);

            const blockchainGroup = zoomableGroup
                .append('g')
                .datum(node)
                .attr('transform', `translate(${node.x}, ${node.y})`)
                .attr('class', 'blockchain-group')
                .style('cursor', 'pointer')
                .style('opacity', () => getChainOpacity(node.id))
                .on('click', (event, d) => {
                    if (selectedChain === d.id) {
                        setSelectedChain(null);

                        // 선택 해제 시 모든 링크 라인 표시
                        zoomableGroup
                            .selectAll('line')
                            .style('visibility', 'visible')
                            .style('opacity', function () {
                                const line = d3.select(this);
                                const linkInfo = linkData.find(
                                    (link) => line.classed(`link-${link.chain1}`) && line.classed(`link-${link.chain2}`)
                                );
                                return linkInfo.shared_validators >= 40 ? 0.6 : 0.3;
                            });
                    } else {
                        // 새로운 체인 선택
                        setSelectedChain(d.id);

                        // 링크 라인 visibility 업데이트
                        zoomableGroup
                            .selectAll('line')
                            .style('visibility', function () {
                                const line = d3.select(this);
                                const isConnected = line.classed(`link-${d.id}`);
                                return isConnected ? 'visible' : 'hidden';
                            })
                            .style('opacity', function () {
                                const line = d3.select(this);
                                if (line.classed(`link-${d.id}`)) {
                                    const linkInfo = linkData.find(
                                        (link) =>
                                            (link.chain1 === d.id && line.classed(`link-${link.chain2}`)) ||
                                            (link.chain2 === d.id && line.classed(`link-${link.chain1}`))
                                    );
                                    return linkInfo.shared_validators >= 40 ? 0.5 : 0.2;
                                }
                                return 0;
                            });
                    }
                });

            // 파이 슬라이스 렌더링
            blockchainGroup
                .selectAll('.pie-slice')
                .data(arcData)
                .enter()
                .append('path')
                .attr('d', pieArc)
                .attr('fill', (d, i) => colorScale(i))
                .attr('class', 'pie-slice')
                .style('opacity', (d, i) => getOpacityForSlice(i))
                .append('title')
                .text((d) => `${node.id} - proportion ${d.data.month}: ${(d.value * 100).toFixed(2)}%`);

            // 바 차트 데이터 및 렌더링
            const barData = Object.entries(chainData.proposal).map(([key, value]) => ({ month: key, value }));

            const barArc = d3
                .arc()
                .innerRadius((d, i) => getInnerRadius(i) + radius - 6)
                .outerRadius((d, i) => getOuterRadius(i) + radius - 6)
                .startAngle(0)
                .endAngle((d) => (d.value / 100) * 2 * Math.PI);

            blockchainGroup
                .selectAll('.bar')
                .data(barData)
                .enter()
                .append('path')
                .attr('d', barArc)
                .attr('fill', '#8aaed3')
                .attr('opacity', 0.7)
                .attr('class', 'bar')
                .append('title')
                .text((d) => `${node.id} - proposal ${d.month}: ${d.value}`);

            // 라벨 추가
            blockchainGroup
                .append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', radius + 15)
                .text(node.id)
                .attr('font-size', '12px')
                .attr('font-weight', 'bold');
        });
    }, [setSelectedChain, highlightedChains, selectedChain, getChainOpacity, activeClusters]);

    return (
        <div className="mt-1">
            <div className="ml-4 mb-2">
                <div className="flex flex-col items-center w-full">
                    <div className="flex gap-5">
                        {clusterArr.map((cluster) => (
                            <div key={cluster} className="flex flex-col items-center w-12">
                                {/* 원형 범례 */}
                                <div
                                    className="w-12 h-12 rounded-full cursor-pointer transition-all duration-200 hover:opacity-80 relative mb-2"
                                    style={{
                                        backgroundColor: NormalColors[cluster],
                                        opacity: activeClusters.has(cluster) ? 1 : 0.4,
                                    }}
                                    onClick={() => toggleCluster(cluster)}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center text-white font-medium">
                                        {cluster}
                                    </div>
                                </div>
                                {/* 설명 텍스트 */}
                                <span className="text-[0.7rem] text-gray-700 text-center">{clusterNames[cluster]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <svg className="ml-4" ref={svgRef}></svg>
        </div>
    );
};

export default NetworkPie;
