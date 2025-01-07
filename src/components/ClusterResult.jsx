import { useEffect, useState } from 'react';
import useChainStore from '../store/store';
import { NormalColors, clusterNames } from './color';

const ClusterResult = () => {
    const { selectedChain, selectedValidators, baseValidator } = useChainStore();
    const [clusterInfo, setClusterInfo] = useState({
        cluster: null,
        friendly: [],
        opposition: [],
    });

    useEffect(() => {
        if (!selectedChain || !baseValidator) {
            setClusterInfo({ cluster: null, friendly: [], opposition: [] });
            return;
        }

        fetch(`/data/validator_result/validator_result_${selectedChain}.json`)
            .then((response) => response.json())
            .then((data) => {
                const baseValidatorData = data.find((item) => item.voter === baseValidator);
                if (!baseValidatorData) return;

                fetch('/data/cluster_relationships.json')
                    .then((response) => response.json())
                    .then((relationsData) => {
                        const clusterNum = baseValidatorData.cluster_label.toString();
                        const chainRelations = relationsData[selectedChain];

                        if (chainRelations && chainRelations[clusterNum]) {
                            setClusterInfo({
                                cluster: clusterNum,
                                friendly: chainRelations[clusterNum].friendly,
                                opposition: chainRelations[clusterNum].opposition,
                            });
                        }
                    });
            });
    }, [selectedChain, baseValidator]);

    const getClusterColor = (index) => {
        return NormalColors[index]; // 색상 배열에 없는 인덱스는 기본값 #000000
    };

    const renderClusterInfo = (clusters) => {
        return clusters.length > 0
            ? clusters.map((cluster) => {
                  const clusterIndex = parseInt(cluster); // 클러스터 번호
                  return (
                      <span
                          key={cluster}
                          style={{
                              backgroundColor: getClusterColor(clusterIndex),
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              color: '#333',
                              marginBottom: '5px',
                              fontSize: '0.8rem',
                          }}
                      >
                          {`${clusterIndex}. ${clusterNames[clusterIndex]}`}
                      </span>
                  );
              })
            : 'None';
    };

    return (
        <div className="w-[95%] h-full  font-medium">
            <p className="p-2 font-semibold">Cluster Results</p>
            <div style={{ maxHeight: 'calc((2rem * 3) + 4.3rem)' }} className=" pl-3 overflow-auto">
                {clusterInfo.cluster ? (
                    <>
                        <p className="text-base">Cluster: {renderClusterInfo([clusterInfo.cluster])}</p>
                        <div className="flex justify-between mb-2 ">
                            {/* Similar Match Clusters 컬럼 */}
                            <div className="w-1/2 pr-2">
                                <p className="mb-1">Similar</p>
                                <div className="text-green-600 text-xs overflow-y-auto">
                                    {/* 클러스터 항목을 한 줄씩 표시 */}
                                    <div className="black w-auto" style={{ display: 'flex', flexDirection: 'column' }}>
                                        {renderClusterInfo(clusterInfo.friendly)} {/* 친화적인 클러스터 */}
                                    </div>
                                </div>
                            </div>

                            {/* Dissimilar Match Clusters 컬럼 */}
                            <div className="w-1/2 pl-2">
                                <p className="mb-1">Unsimilar:</p>
                                <div className="text-red-600 text-xs overflow-y-auto">
                                    {/* 클러스터 항목을 한 줄씩 표시 */}
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {renderClusterInfo(clusterInfo.opposition)} {/* 반대적인 클러스터 */}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-gray-500">No validator selected</p>
                )}
            </div>
        </div>
    );
};

export default ClusterResult;
